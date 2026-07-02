/**
 * Supabase Edge Function: appointments
 * CRUD + WhatsApp auto-send on create
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_RPS = 30, MAX_RPH = 200;

function sanitize(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/[<>]/g, "").replace(/javascript:/gi, "").replace(/on\w+=/gi, "").trim().substring(0, 1000);
}
function validatePhone(p: string): string | null {
  const c = (p || "").replace(/\D/g, "");
  return /^\d{10,15}$/.test(c) ? c : null;
}
function validateDate(d: string): string | null {
  const date = new Date(d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const max = new Date(); max.setDate(max.getDate() + 60);
  return date >= today && date <= max ? d : null;
}
function validateTime(t: string): string | null {
  return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(t) ? t : null;
}

async function rateLimit(supabase: any, ip: string, endpoint: string) {
  const now = new Date();
  const m1 = new Date(+now - 60_000).toISOString();
  const h1 = new Date(+now - 3_600_000).toISOString();
  const { data: md } = await supabase.from("rate_limit_logs")
    .select("count").eq("ip_address", ip).eq("endpoint", endpoint).gte("timestamp", m1);
  if ((md || []).reduce((s: number, r: any) => s + r.count, 0) >= MAX_RPS)
    return { allowed: false, retryAfter: 60 };
  const { data: hd } = await supabase.from("rate_limit_logs")
    .select("count").eq("ip_address", ip).eq("endpoint", endpoint).gte("timestamp", h1);
  if ((hd || []).reduce((s: number, r: any) => s + r.count, 0) >= MAX_RPH)
    return { allowed: false, retryAfter: 3600 };
  await supabase.from("rate_limit_logs").insert({ ip_address: ip, endpoint, method: "POST", count: 1 });
  return { allowed: true };
}

async function verifyAdmin(supabase: any, token: string | null): Promise<boolean> {
  if (!token) return false;
  const { data } = await supabase.from("admin_sessions").select("id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).single();
  return !!data;
}

async function generateQueueNumber(supabase: any, tanggal: string): Promise<string> {
  const { count } = await supabase.from("appointments")
    .select("id", { count: "exact" }).eq("tanggal", tanggal);
  const n = count || 0;
  const prefix = String.fromCharCode(65 + Math.floor(n / 999) % 26);
  return `${prefix}-${String((n % 999) + 1).padStart(3, "0")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Rate limit mutations
    if (["POST", "PUT", "DELETE"].includes(method)) {
      const { allowed, retryAfter } = await rateLimit(supabase, ip, path);
      if (!allowed) return json({ success: false, message: "Rate limit. Coba lagi nanti.", retryAfter }, 429);
    }

    // ── GET /appointments ──────────────────────────────────────
    if (method === "GET" && path.endsWith("/appointments")) {
      const { data, error } = await supabase
        .from("appointments").select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ success: true, data });
    }

    // ── GET /appointments/:id ──────────────────────────────────
    if (method === "GET" && path.match(/\/appointments\/[^/]+$/)) {
      const id = path.split("/").pop();
      const { data, error } = await supabase
        .from("appointments").select("*").eq("id", id).single();
      if (error || !data) return json({ success: false, message: "Tidak ditemukan" }, 404);
      return json({ success: true, data });
    }

    // ── POST /appointments ─────────────────────────────────────
    if (method === "POST" && path.endsWith("/appointments")) {
      const body = await req.json();

      const namaLengkap    = sanitize(body.namaLengkap);
      const nomorWA        = validatePhone(body.nomorWA);
      const tujuanBertemu  = sanitize(body.tujuanBertemu);
      const keperluan      = sanitize(body.keperluan);
      const tanggal        = validateDate(body.tanggal);
      const jam            = validateTime(body.jam);
      const instansi       = body.instansi ? sanitize(body.instansi) : null;
      const dokumenUrl     = body.dokumenUrl ? sanitize(body.dokumenUrl) : null;

      const errors: string[] = [];
      if (!namaLengkap || namaLengkap.length < 3) errors.push("Nama lengkap minimal 3 karakter");
      if (!nomorWA) errors.push("Nomor WhatsApp tidak valid (10–15 digit)");
      if (!tujuanBertemu) errors.push("Tujuan bertemu wajib dipilih");
      if (!keperluan || keperluan.length < 10) errors.push("Keperluan minimal 10 karakter");
      if (!tanggal) errors.push("Tanggal tidak valid (maks 60 hari ke depan)");
      if (!jam) errors.push("Jam tidak valid");
      if (errors.length) return json({ success: false, errors }, 400);

      const nomorAntrian = await generateQueueNumber(supabase, tanggal!);

      const { data, error } = await supabase.from("appointments").insert({
        nomor_antrian: nomorAntrian,
        nama_lengkap: namaLengkap,
        nomor_wa: nomorWA,
        instansi,
        tujuan_bertemu: tujuanBertemu,
        keperluan,
        tanggal,
        jam,
        status: "Menunggu Konfirmasi",
        dokumen_url: dokumenUrl,
      }).select().single();

      if (error) throw error;

      // Trigger WhatsApp send (non-blocking)
      const waFnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send`;
      fetch(waFnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ appointmentId: data.id }),
      }).catch((e) => console.warn("WA trigger failed:", e));

      return json({ success: true, data }, 201);
    }

    // ── PUT /appointments/:id ──────────────────────────────────
    if (method === "PUT" && path.match(/\/appointments\/[^/]+$/)) {
      const token = req.headers.get("x-admin-token");
      if (!(await verifyAdmin(supabase, token)))
        return json({ success: false, message: "Unauthorized" }, 401);

      const id = path.split("/").pop();
      const body = await req.json();
      const allowed = ["status", "nama_lengkap", "tujuan_bertemu", "tanggal", "jam", "dokumen_url"];
      const validStatuses = ["Menunggu Konfirmasi", "Dikonfirmasi", "Selesai", "Dibatalkan"];
      const updates: Record<string, unknown> = {};

      for (const k of allowed) {
        if (body[k] === undefined) continue;
        if (k === "status") {
          if (!validStatuses.includes(body[k])) return json({ success: false, message: "Status tidak valid" }, 400);
          updates[k] = body[k];
        } else {
          updates[k] = sanitize(body[k]);
        }
      }
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase.from("appointments")
        .update(updates).eq("id", id).select().single();
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        action: "UPDATE_APPOINTMENT", details: { id, changes: updates }, ip_address: ip,
      });

      return json({ success: true, data });
    }

    // ── DELETE /appointments/:id ───────────────────────────────
    if (method === "DELETE" && path.match(/\/appointments\/[^/]+$/)) {
      const token = req.headers.get("x-admin-token");
      if (!(await verifyAdmin(supabase, token)))
        return json({ success: false, message: "Unauthorized" }, 401);

      const id = path.split("/").pop();
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        action: "DELETE_APPOINTMENT", details: { id }, ip_address: ip,
      });
      return json({ success: true });
    }

    return json({ success: false, message: "Not found" }, 404);
  } catch (err: any) {
    console.error("appointments error:", err);
    return json({ success: false, message: "Internal server error", detail: err.message }, 500);
  }
});
