import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const today = new Date().toISOString().split("T")[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date();
    monthStart.setDate(1);

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("tanggal, status, created_at");

    if (error) throw error;

    const stats = {
      total: appointments.length,
      today: appointments.filter(a => a.tanggal === today && a.status !== "Dibatalkan").length,
      week: appointments.filter(a => new Date(a.tanggal) >= weekStart && a.status !== "Dibatalkan").length,
      month: appointments.filter(a => new Date(a.tanggal) >= monthStart && a.status !== "Dibatalkan").length,
      done: appointments.filter(a => a.status === "Selesai").length,
      waiting: appointments.filter(a => a.status === "Menunggu Konfirmasi").length,
      confirmed: appointments.filter(a => a.status === "Dikonfirmasi").length,
      cancelled: appointments.filter(a => a.status === "Dibatalkan").length,
    };

    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const count = appointments.filter(a => a.tanggal === dateStr).length;
      const label = date.toLocaleDateString("id-ID", { weekday: "short" });
      chartData.push({ label, value: count, date: dateStr });
    }

    const monthlyData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const count = appointments.filter(a => a.tanggal === dateStr).length;
      monthlyData.push({ date: dateStr, value: count });
    }

    return new Response(
      JSON.stringify({ success: true, stats, chartData, monthlyData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Stats error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

