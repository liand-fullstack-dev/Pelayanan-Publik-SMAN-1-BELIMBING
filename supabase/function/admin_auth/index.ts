import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

const ADMIN_USERNAME = "SMANSABEL_7";
const ADMIN_PASSWORD = "SMANSABEL_Jaya";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const body = await req.json();
    const action = body.action;

    if (action === "login") {
      const { username, password } = body;

      const { data: recentAttempts } = await supabase
        .from("rate_limit_logs")
        .select("count")
        .eq("ip_address", ip)
        .eq("endpoint", "/admin-auth")
        .gte("timestamp", new Date(Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString());

      const attemptCount = recentAttempts?.reduce((sum, r) => sum + r.count, 0) || 0;

      if (attemptCount >= MAX_LOGIN_ATTEMPTS) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Terlalu banyak percobaan login. Silakan coba lagi dalam 30 menit.",
            locked: true,
            retryAfter: LOCKOUT_DURATION_MINUTES * 60,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Retry-After": String(LOCKOUT_DURATION_MINUTES * 60),
              "Content-Type": "application/json",
            },
          }
        );
      }

      await supabase.from("rate_limit_logs").insert({
        ip_address: ip,
        endpoint: "/admin-auth",
        method: "POST",
        count: 1,
      });

      if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Username atau password salah",
            attemptsRemaining: MAX_LOGIN_ATTEMPTS - attemptCount - 1,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rawToken = crypto.randomUUID() + Date.now() + Math.random().toString(36);
      const sessionToken = await hashToken(rawToken);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await supabase.from("admin_sessions").insert({
        session_token: sessionToken,
        ip_address: ip,
        user_agent: req.headers.get("user-agent") || "unknown",
        expires_at: expiresAt.toISOString(),
      });

      await supabase.from("activity_logs").insert({
        action: "ADMIN_LOGIN",
        details: { ip_address: ip },
        ip_address: ip,
      });

      return new Response(
        JSON.stringify({
          success: true,
          token: sessionToken,
          expiresAt: expiresAt.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      const { token } = body;

      if (!token) {
        return new Response(
          JSON.stringify({ success: false, message: "Token required" }),
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
          JSON.stringify({ success: false, message: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("admin_sessions")
        .update({ last_active: new Date().toISOString() })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({ success: true, valid: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "logout") {
      const { token } = body;

      if (token) {
        await supabase
          .from("admin_sessions")
          .delete()
          .eq("session_token", token);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Logged out" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset") {
      const { currentPassword, newPassword } = body;

      if (currentPassword !== ADMIN_PASSWORD) {
        return new Response(
          JSON.stringify({ success: false, message: "Password saat ini salah" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!newPassword || newPassword.length < 8) {
        return new Response(
          JSON.stringify({ success: false, message: "Password baru minimal 8 karakter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("activity_logs").insert({
        action: "PASSWORD_RESET",
        details: { ip_address: ip },
        ip_address: ip,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Password reset berhasil. Silakan update di Supabase Dashboard." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Auth error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

