/**
 * Supabase Edge Function: whatsapp-send
 * Mengirim pesan WhatsApp ke nomor tujuan berdasarkan role melalui
 * FullStackNotes API (https://api.fullstacknotes.org)
 *
 * POST /whatsapp-send
 * Body: { appointmentId: string }
 *
 * Alur:
 * 1. Ambil data appointment dari DB
 * 2. Ambil nomor target berdasarkan tujuan_bertemu dari whatsapp_targets
 * 3. Ambil API key, session_id dari admin_settings
 * 4. Kirim pesan via API
 * 5. Fallback ke nomor default jika tidak ada nomor spesifik
 * 6. Log hasil ke activity_logs
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { corsHeaders } from "../_shared/cors.ts";

const WA_API_BASE = "https://api.fullstacknotes.org/api/v1";
const DEFAULT_FALLBACK_NUMBER = "6282382734762";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { appointmentId } = body;

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ success: false, message: "appointmentId diperlukan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Ambil data appointment
    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .single();

    if (aptErr || !apt) {
      return new Response(
        JSON.stringify({ success: false, message: "Appointment tidak ditemukan" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Ambil admin settings (API key, session_id, default number)
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", ["wa_api_key", "wa_session_id", "wa_default_number"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    const apiKey = settingsMap["wa_api_key"] || "fsk_live_123456789";
    const sessionId = settingsMap["wa_session_id"] || "ses_xxxxxxxx";
    const defaultNumber = settingsMap["wa_default_number"] || DEFAULT_FALLBACK_NUMBER;

    // 3. Ambil nomor target berdasarkan tujuan_bertemu
    const { data: target } = await supabase
      .from("whatsapp_targets")
      .select("phone_number")
      .eq("role", apt.tujuan_bertemu)
      .eq("is_active", true)
      .single();

    const targetPhone = target?.phone_number || defaultNumber;

    // 4. Format pesan lengkap
    const tanggalFormatted = new Date(apt.tanggal + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const jamFormatted = apt.jam ? apt.jam.substring(0, 5) + " WIB" : "-";

    const message = [
      "🔔 *NOTIFIKASI JANJI TEMU BARU*",
      "_Portal Pelayanan Digital SMAN 1 BELIMBING_",
      "",
      `📋 *Nomor Antrian:* ${apt.nomor_antrian}`,
      `👤 *Nama:* ${apt.nama_lengkap}`,
      `📱 *WhatsApp:* ${apt.nomor_wa}`,
      apt.instansi ? `🏢 *Instansi:* ${apt.instansi}` : null,
      `🎯 *Tujuan:* ${apt.tujuan_bertemu}`,
      `📝 *Keperluan:* ${apt.keperluan}`,
      `📅 *Tanggal:* ${tanggalFormatted}`,
      `⏰ *Jam:* ${jamFormatted}`,
      apt.dokumen_url ? `📎 *Dokumen:* ${apt.dokumen_url}` : null,
      "",
      "Silakan konfirmasi atau tindak lanjuti janji temu ini.",
      `Status dapat diubah melalui Dashboard Admin.`,
    ].filter(Boolean).join("\n");

    // 5. Kirim pesan ke nomor tujuan (pejabat/staff yang dituju)
    let waResult = { sent: false, error: null as string | null };

    try {
      const response = await fetch(`${WA_API_BASE}/messages/send`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: targetPhone,
          message: message,
          session_id: sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }

      waResult.sent = true;
    } catch (err: any) {
      waResult.error = err.message;
      console.error("WhatsApp send error:", err);
    }

    // 6. Coba kirim konfirmasi ke pengguna (nomor WA pengaju)
    let userConfirmSent = false;
    try {
      const userMessage = [
        "✅ *Janji Temu Berhasil Diajukan!*",
        "_Portal Pelayanan Digital SMAN 1 BELIMBING_",
        "",
        `Nomor Antrian Anda: *${apt.nomor_antrian}*`,
        "",
        `📅 Tanggal: ${tanggalFormatted}`,
        `⏰ Jam: ${jamFormatted}`,
        `🎯 Bertemu: ${apt.tujuan_bertemu}`,
        "",
        "Harap simpan nomor antrian ini.",
        "Pihak sekolah akan menghubungi Anda untuk konfirmasi.",
        "",
        "_Terima kasih telah menggunakan Portal Pelayanan Digital SMAN 1 BELIMBING_",
      ].join("\n");

      const userPhone = (apt.nomor_wa || "").replace(/\D/g, "");
      if (userPhone.length >= 10) {
        const resp = await fetch(`${WA_API_BASE}/messages/send`, {
          method: "POST",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ phone: userPhone, message: userMessage, session_id: sessionId }),
        });
        userConfirmSent = resp.ok;
      }
    } catch (_) {
      // Best-effort — tidak gagalkan request utama
    }

    // 7. Log ke activity_logs
    await supabase.from("activity_logs").insert({
      action: "WHATSAPP_SEND",
      details: {
        appointment_id: appointmentId,
        nomor_antrian: apt.nomor_antrian,
        target_phone: targetPhone,
        user_phone: apt.nomor_wa,
        sent: waResult.sent,
        user_confirm_sent: userConfirmSent,
        error: waResult.error,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          sent: waResult.sent,
          target_phone: targetPhone,
          user_confirm_sent: userConfirmSent,
          fallback_used: !target?.phone_number,
          error: waResult.error,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("whatsapp-send error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error", detail: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

