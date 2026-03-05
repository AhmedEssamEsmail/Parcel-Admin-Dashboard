import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.floor(p * (sortedValues.length - 1))));
  return sortedValues[idx];
}

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("v_parcel_kpi")
    .select("warehouse_code,created_date_local,order_ts_utc,delivered_ts")
    .gte("created_date_local", from)
    .lte("created_date_local", to)
    .not("delivered_ts", "is", null)
    .limit(30000);

  if (warehouse && warehouse !== "ALL") query = query.eq("warehouse_code", warehouse);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bins = [
    { label: "0-30m", min: 0, max: 30, count: 0 },
    { label: "30-60m", min: 30, max: 60, count: 0 },
    { label: "1-2h", min: 60, max: 120, count: 0 },
    { label: "2-4h", min: 120, max: 240, count: 0 },
    { label: "4h+", min: 240, max: Number.POSITIVE_INFINITY, count: 0 },
  ];

  const byDay = new Map<string, number[]>();

  for (const row of data ?? []) {
    const ordered = new Date(String(row.order_ts_utc)).getTime();
    const delivered = new Date(String(row.delivered_ts)).getTime();
    if (Number.isNaN(ordered) || Number.isNaN(delivered)) continue;

    const minutes = Math.max(0, Math.round((delivered - ordered) / 60000));
    const bin = bins.find((item) => minutes >= item.min && minutes < item.max);
    if (bin) bin.count += 1;

    const day = String(row.created_date_local);
    const dayList = byDay.get(day) ?? [];
    dayList.push(minutes);
    byDay.set(day, dayList);
  }

  const percentiles = Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        day,
        p50: percentile(sorted, 0.5),
        p90: percentile(sorted, 0.9),
        p95: percentile(sorted, 0.95),
      };
    });

  return NextResponse.json({ bins, percentiles });
});
