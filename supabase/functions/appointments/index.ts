import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { corsHeaders } from "../_shared/cors.ts";

// Security constants
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_REQUESTS_PER_HOUR = 200;
const BLOCK_DURATION_MINUTES = 15;

// Input sanitization
function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim()
    .substring(0, 500);
}

function validatePhone(phone) {
  const clean = phone.replace(/\D/g, "");
  return /^\d{10,15}$/.test(clean) ? clean : null;
}

function validateDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  return date >= today && date <= maxDate ? dateStr : null;
}

function validateTime(timeStr) {
  return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(timeStr) ? timeStr : null;
}

// Rate limiting
async function checkRateLimit(supabase, ip, endpoint) {
  const now = new Date();
  const oneMinuteAgo = new Date(now - 60 * 1000);
  const oneHourAgo = new Date(now - 60 * 60 * 1000);

  const { data: minuteData } = await supabase
    .from("rate_limit_logs")
    .select("count")
    .eq("ip_address", ip)
    .eq("endpoint", endpoint)
    .gte("timestamp", oneMinuteAgo.toISOString());

  const minuteCount = minuteData?.reduce((sum, r) => sum + r.count, 0) || 0;
  if (minuteCount >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, retryAfter: 60 };
  }

  const { data: hourData } = await supabase
    .from("rate_limit_logs")
    .select("count")
    .eq("ip_address", ip)
    .eq("endpoint", endpoint)
    .gte("timestamp", oneHourAgo.toISOString());

  const hourCount = hourData?.reduce((sum, r) => sum + r.count, 0) || 0;
  if (hourCount >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, retryAfter: 3600 };
  }

  await supabase.from("rate_limit_logs").insert({
    ip_address: ip,
    endpoint: endpoint,
    method: "POST",
    count: 1,
  });

  return { allowed: true };
}

// Verify admin token
async function verifyAdminToken(supabase, token) {
  if (!token) return false;
  const { data } = await supabase
    .from("admin_sessions")
    .select("*")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .single();
  return !!data;
}

// Generate queue number
async function generateQueueNumber(supabase, tanggal) {
  const { data } = await supabase
    .from("appointments")
    .select("id")
    .eq("tanggal", tanggal);

  const count = data?.length || 0;
  const prefix = String.fromCharCode(65 + Math.floor(count / 999) % 26);
  const number = String((count % 999) + 1).padStart(3, "0");
  return `${prefix}-${number}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Rate limit check for mutations
    if (method === "POST" || method === "PUT" || method === "DELETE") {
      const rateCheck = await checkRateLimit(supabase, ip, path);
      if (!rateCheck.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Rate limit exceeded. Please try again later.",
            retryAfter: rateCheck.retryAfter,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Retry-After": String(rateCheck.retryAfter),
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // GET /appointments - List all (public)
    if (method === "GET" && path.endsWith("/appointments")) {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /appointments - Create new (public)
    if (method === "POST" && path.endsWith("/appointments")) {
      const body = await req.json();

      const namaLengkap = sanitizeInput(body.namaLengkap);
      const nomorWA = validatePhone(body.nomorWA);
      const tujuanBertemu = sanitizeInput(body.tujuanBertemu);
      const keperluan = sanitizeInput(body.keperluan);
      const tanggal = validateDate(body.tanggal);
      const jam = validateTime(body.jam);
      const instansi = body.instansi ? sanitizeInput(body.instansi) : null;

      const errors = [];
      if (!namaLengkap || namaLengkap.length < 3) errors.push("Nama lengkap minimal 3 karakter");
      if (!nomorWA) errors.push("Nomor WhatsApp tidak valid");
      if (!tujuanBertemu) errors.push("Tujuan bertemu wajib dipilih");
      if (!keperluan || keperluan.length < 10) errors.push("Keperluan minimal 10 karakter");
      if (!tanggal) errors.push("Tanggal tidak valid (maksimal 30 hari ke depan)");
      if (!jam) errors.push("Jam tidak valid");

      if (errors.length > 0) {
        return new Response(
          JSON.stringify({ success: false, errors }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const nomorAntrian = await generateQueueNumber(supabase, tanggal);

      const { data, error } = await supabase
        .from("appointments")
        .insert({
          nomor_antrian: nomorAntrian,
          nama_lengkap: namaLengkap,
          nomor_wa: nomorWA,
          instansi: instansi,
          tujuan_bertemu: tujuanBertemu,
          keperluan: keperluan,
          tanggal: tanggal,
          jam: jam,
          status: "Menunggu Konfirmasi",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PUT /appointments/:id - Update (admin only)
    if (method === "PUT" && path.match(/\/appointments\/[^/]+$/)) {
      const adminToken = req.headers.get("x-admin-token");
      const isAdmin = await verifyAdminToken(supabase, adminToken);

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, message: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const id = path.split("/").pop();
      const body = await req.json();

      const allowedUpdates = ["status", "nama_lengkap", "tujuan_bertemu", "tanggal", "jam"];
      const updates = {};

      for (const key of allowedUpdates) {
        if (body[key] !== undefined) {
          if (key === "status") {
            const validStatuses = ["Menunggu Konfirmasi", "Dikonfirmasi", "Selesai", "Dibatalkan"];
            if (!validStatuses.includes(body[key])) {
              return new Response(
                JSON.stringify({ success: false, message: "Status tidak valid" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            updates[key] = body[key];
          } else {
            updates[key] = sanitizeInput(body[key]);
          }
        }
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("appointments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await supabase.from("activity_logs").insert({
        action: "UPDATE_APPOINTMENT",
        details: { id, changes: updates },
        ip_address: ip,
      });

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE /appointments/:id - Delete (admin only)
    if (method === "DELETE" && path.match(/\/appointments\/[^/]+$/)) {
      const adminToken = req.headers.get("x-admin-token");
      const isAdmin = await verifyAdminToken(supabase, adminToken);

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ success: false, message: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const id = path.split("/").pop();

      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await supabase.from("activity_logs").insert({
        action: "DELETE_APPOINTMENT",
        details: { id },
        ip_address: ip,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Appointment deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

