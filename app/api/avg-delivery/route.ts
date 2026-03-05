import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type AvgDeliveryRow = {
  day: string;
  delivered_count: number;
  avg_minutes: number;
  median_minutes: number | null;
};

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  if (!warehouse) {
    return NextResponse.json(
      { error: "warehouse query param is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("v_avg_delivery_time_daily_rollup")
    .select("*")
    .eq("warehouse_code", warehouse)
    .gte("day", from || "1900-01-01")
    .lte("day", to || "2100-01-01")
    .order("day", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as AvgDeliveryRow[];

  return NextResponse.json({
    overall: calculateOverallStats(rows),
    trend: calculateTrend(rows),
    daily: data,
  });
});

function calculateOverallStats(data: AvgDeliveryRow[]) {
  if (!data || data.length === 0) {
    return { avg_minutes: null, median_minutes: null, total_delivered: 0 };
  }

  const totalDelivered = data.reduce((sum, row) => sum + row.delivered_count, 0);
  const weightedSum = data.reduce(
    (sum, row) => sum + row.avg_minutes * row.delivered_count,
    0,
  );

  return {
    avg_minutes: totalDelivered > 0 ? Math.round(weightedSum / totalDelivered) : null,
    median_minutes: data[Math.floor(data.length / 2)]?.median_minutes || null,
    total_delivered: totalDelivered,
  };
}

function calculateTrend(data: AvgDeliveryRow[]) {
  if (data.length < 2) return { direction: "stable", change_minutes: 0 };

  const current = data[0]?.avg_minutes || 0;
  const previous = data[1]?.avg_minutes || 0;
  const change = current - previous;

  return {
    direction: change > 5 ? "increasing" : change < -5 ? "decreasing" : "stable",
    change_minutes: Math.round(change),
  };
}
