/**
 * Edge Function: reports
 * GET /reports?period=week|month|custom&start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns CSV data for appointment reports
 * Requires x-admin-token header
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Verify admin token
  const token = req.headers.get("x-admin-token");
  if (!token) return json({ success: false, message: "Unauthorized" }, 401);

  const { data: session } = await supabase
    .from("admin_sessions").select("id").eq("session_token", token)
    .gt("expires_at", new Date().toISOString()).single();
  if (!session) return json({ success: false, message: "Sesi tidak valid" }, 401);

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "week";
    let startDate: string, endDate: string;

    const today = new Date();
    endDate = today.toISOString().split("T")[0];

    if (period === "week") {
      const s = new Date(today); s.setDate(s.getDate() - 6);
      startDate = s.toISOString().split("T")[0];
    } else if (period === "month") {
      const s = new Date(today); s.setDate(1);
      startDate = s.toISOString().split("T")[0];
    } else if (period === "custom") {
      startDate = url.searchParams.get("start") || endDate;
      endDate   = url.searchParams.get("end")   || endDate;
    } else {
      return json({ success: false, message: "Period tidak valid" }, 400);
    }

    const { data: rows, error } = await supabase
      .from("appointments")
      .select("nomor_antrian, nama_lengkap, nomor_wa, instansi, tujuan_bertemu, keperluan, tanggal, jam, status, created_at, dokumen_url")
      .gte("tanggal", startDate)
      .lte("tanggal", endDate)
      .order("tanggal", { ascending: true })
      .order("jam", { ascending: true });

    if (error) throw error;

    const items = rows || [];

    // Summary stats
    const summary = {
      total:     items.length,
      selesai:   items.filter(r => r.status === "Selesai").length,
      dikonfirmasi: items.filter(r => r.status === "Dikonfirmasi").length,
      menunggu:  items.filter(r => r.status === "Menunggu Konfirmasi").length,
      dibatalkan: items.filter(r => r.status === "Dibatalkan").length,
      startDate,
      endDate,
      period,
    };

    return json({ success: true, data: items, summary });
  } catch (err: any) {
    return json({ success: false, message: err.message }, 500);
  }
});

