/**
 * Supabase Edge Function: admin-auth
 * Login, verify, logout, reset-password — semuanya lewat DB settings
 * Password disimpan di admin_settings table sehingga reset benar-benar berfungsi
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const body = await req.json();
    const { action } = body;

    // ── LOGIN ─────────────────────────────────────────────────
    if (action === "login") {
      const { username, password } = body;

      // Cek rate limit / lockout
      const since = new Date(Date.now() - LOCKOUT_DURATION_MINUTES * 60_000).toISOString();
      const { data: attempts } = await supabase
        .from("rate_limit_logs")
        .select("count")
        .eq("ip_address", ip)
        .eq("endpoint", "/admin-auth/login")
        .gte("timestamp", since);

      const attemptCount = (attempts || []).reduce((s: number, r: any) => s + r.count, 0);
      if (attemptCount >= MAX_LOGIN_ATTEMPTS) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Akun terkunci. Coba lagi dalam ${LOCKOUT_DURATION_MINUTES} menit.`,
            locked: true,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Ambil credentials dari DB
      const { data: settings } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", ["admin_username", "admin_password"]);

      const settingsMap: Record<string, string> = {};
      (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

      const correctUsername = settingsMap["admin_username"] || "SMANSABEL_7";
      const correctPassword = settingsMap["admin_password"] || "SMANSABEL_Jaya";

      if (!username || !password || username !== correctUsername || password !== correctPassword) {
        // Log failed attempt
        await supabase.from("rate_limit_logs").insert({
          ip_address: ip, endpoint: "/admin-auth/login", method: "POST", count: 1,
        });
        return new Response(
          JSON.stringify({
            success: false,
            message: "Username atau password salah",
            attemptsRemaining: MAX_LOGIN_ATTEMPTS - attemptCount - 1,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buat session token
      const rawToken = crypto.randomUUID() + Date.now().toString(36) + Math.random().toString(36);
      const sessionToken = await hashString(rawToken + supabaseKey);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);

      await supabase.from("admin_sessions").insert({
        session_token: sessionToken,
        ip_address: ip,
        user_agent: req.headers.get("user-agent") || "unknown",
        expires_at: expiresAt.toISOString(),
      });

      await supabase.from("activity_logs").insert({
        action: "ADMIN_LOGIN", details: { ip_address: ip }, ip_address: ip,
      });

      return new Response(
        JSON.stringify({ success: true, token: sessionToken, expiresAt: expiresAt.toISOString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── VERIFY ────────────────────────────────────────────────
    if (action === "verify") {
      const { token } = body;
      if (!token) {
        return new Response(
          JSON.stringify({ success: false, valid: false }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await supabase
        .from("admin_sessions")
        .select("*")
        .eq("session_token", token)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ success: false, valid: false }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update last_active
      await supabase.from("admin_sessions")
        .update({ last_active: new Date().toISOString() })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({ success: true, valid: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LOGOUT ────────────────────────────────────────────────
    if (action === "logout") {
      const { token } = body;
      if (token) {
        await supabase.from("admin_sessions").delete().eq("session_token", token);
      }
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RESET PASSWORD ────────────────────────────────────────
    if (action === "reset") {
      const { token, currentPassword, newPassword } = body;

      // Verifikasi sesi admin
      if (!token) {
        return new Response(
          JSON.stringify({ success: false, message: "Login diperlukan untuk reset password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: session } = await supabase
        .from("admin_sessions")
        .select("id")
        .eq("session_token", token)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ success: false, message: "Sesi tidak valid. Silakan login ulang." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verifikasi password saat ini
      const { data: pwSetting } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "admin_password")
        .single();

      const storedPassword = pwSetting?.value || "SMANSABEL_Jaya";
      if (currentPassword !== storedPassword) {
        return new Response(
          JSON.stringify({ success: false, message: "Password saat ini tidak sesuai" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!newPassword || newPassword.length < 8) {
        return new Response(
          JSON.stringify({ success: false, message: "Password baru minimal 8 karakter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (newPassword === currentPassword) {
        return new Response(
          JSON.stringify({ success: false, message: "Password baru tidak boleh sama dengan password lama" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update password di DB
      await supabase
        .from("admin_settings")
        .update({ value: newPassword })
        .eq("key", "admin_password");

      // Hapus semua sesi lain (security)
      await supabase.from("admin_sessions").delete().neq("session_token", token);

      await supabase.from("activity_logs").insert({
        action: "PASSWORD_RESET",
        details: { ip_address: ip, note: "Password berhasil diubah" },
        ip_address: ip,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Password berhasil diperbarui. Sesi lain telah dihapus." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GET SETTINGS (admin only) ──────────────────────────────
    if (action === "getSettings") {
      const { token } = body;
      const { data: session } = await supabase
        .from("admin_sessions").select("id").eq("session_token", token)
        .gt("expires_at", new Date().toISOString()).single();
      if (!session) {
        return new Response(
          JSON.stringify({ success: false, message: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: settings } = await supabase
        .from("admin_settings").select("key, value, description, updated_at");
      const { data: targets } = await supabase
        .from("whatsapp_targets").select("*").order("role");

      return new Response(
        JSON.stringify({ success: true, settings: settings || [], targets: targets || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPDATE SETTINGS (admin only) ──────────────────────────
    if (action === "updateSettings") {
      const { token, settings, targets } = body;
      const { data: session } = await supabase
        .from("admin_sessions").select("id").eq("session_token", token)
        .gt("expires_at", new Date().toISOString()).single();
      if (!session) {
        return new Response(
          JSON.stringify({ success: false, message: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update settings (hanya yang diizinkan)
      const allowedKeys = ["wa_api_key", "wa_session_id", "wa_default_number"];
      if (settings && Array.isArray(settings)) {
        for (const s of settings) {
          if (allowedKeys.includes(s.key)) {
            await supabase.from("admin_settings").update({ value: s.value }).eq("key", s.key);
          }
        }
      }

      // Update targets (phone numbers)
      if (targets && Array.isArray(targets)) {
        for (const t of targets) {
          if (t.role && t.phone_number) {
            const clean = (t.phone_number + "").replace(/\D/g, "");
            if (clean.length >= 10) {
              await supabase.from("whatsapp_targets")
                .upsert({ role: t.role, phone_number: clean, is_active: t.is_active !== false })
                .eq("role", t.role);
            }
          }
        }
      }

      await supabase.from("activity_logs").insert({
        action: "SETTINGS_UPDATE", details: { updated_keys: settings?.map((s: any) => s.key) }, ip_address: ip,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Pengaturan berhasil disimpan" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "Action tidak valid" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("admin-auth error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
