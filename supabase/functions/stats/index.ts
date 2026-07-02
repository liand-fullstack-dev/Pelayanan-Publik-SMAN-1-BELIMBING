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

  try {
    const today = new Date().toISOString().split("T")[0];
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(); monthStart.setDate(1);

    const { data: all } = await supabase.from("appointments").select("id, status, tanggal, created_at");
    const rows = all || [];

    const stats = {
      total:      rows.length,
      today:      rows.filter(r => r.tanggal === today && r.status !== "Dibatalkan").length,
      week:       rows.filter(r => new Date(r.tanggal) >= weekStart && r.status !== "Dibatalkan").length,
      month:      rows.filter(r => new Date(r.tanggal) >= monthStart && r.status !== "Dibatalkan").length,
      done:       rows.filter(r => r.status === "Selesai").length,
      waiting:    rows.filter(r => r.status === "Menunggu Konfirmasi").length,
      confirmed:  rows.filter(r => r.status === "Dikonfirmasi").length,
      cancelled:  rows.filter(r => r.status === "Dibatalkan").length,
    };

    // Chart data for last 30 days
    const chartData: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      chartData.push({ date: ds, count: rows.filter(r => r.tanggal === ds).length });
    }

    return json({ success: true, stats, chartData });
  } catch (err: any) {
    return json({ success: false, message: err.message }, 500);
  }
});
