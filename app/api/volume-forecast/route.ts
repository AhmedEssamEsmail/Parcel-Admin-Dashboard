import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type DailyRow = { day: string; total_placed_inc_wa: number };

function nextDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("v_dod_summary")
    .select("day,total_placed_inc_wa,warehouse_code")
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });

  if (warehouse && warehouse !== "ALL") query = query.eq("warehouse_code", warehouse);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalsByDay = new Map<string, number>();
  for (const row of (data ?? []) as Array<DailyRow & { warehouse_code: string }>) {
    totalsByDay.set(row.day, (totalsByDay.get(row.day) ?? 0) + Number(row.total_placed_inc_wa ?? 0));
  }

  const historical = Array.from(totalsByDay.entries()).map(([day, value]) => ({ day, value }));
  const tail = historical.slice(-7).map((item) => item.value);
  const fallbackSeries = historical.slice(-14).map((item) => item.value);
  const baselineSeries = tail.length > 0 ? tail : fallbackSeries.length > 0 ? fallbackSeries : [0];
  const baseline = baselineSeries.reduce((sum, value) => sum + value, 0) / baselineSeries.length;

  const lastDay = historical.length > 0 ? historical[historical.length - 1].day : to;
  const forecast = Array.from({ length: 7 }).map((_, index) => {
    const trend = index * 0.02;
    const value = Math.max(0, Math.round(baseline * (1 + trend)));
    return { day: nextDate(lastDay, index + 1), value };
  });

  return NextResponse.json({
    historical,
    forecast,
    model_notes: "Deterministic baseline forecast using recent average with light upward trend.",
  });
});
