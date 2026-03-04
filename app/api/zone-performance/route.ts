import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ZonePerformanceRow = {
  warehouse_code: string;
  zone: string;
  city: string;
  area: string | null;
  day: string;
  total_orders: number;
  delivered_count: number;
  on_time_count: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  volume_status: string;
};

type ZoneAggregate = {
  zone: string;
  total_orders: number;
  delivered_count: number;
  on_time_count: number;
  late_count: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  volume_status: string;
};

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const view = params.get("view")?.trim() || "summary";

  if (!warehouse) {
    return NextResponse.json(
      { error: "warehouse query param is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("v_zone_performance")
    .select("*")
    .eq("warehouse_code", warehouse);

  if (from) query = query.gte("day", from);
  if (to) query = query.lte("day", to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const aggregated = aggregateByZone((data ?? []) as ZonePerformanceRow[]);
  const sorted = [...aggregated].sort((a, b) => (b.otd_pct || 0) - (a.otd_pct || 0));

  let result;
  switch (view) {
    case "top":
      result = { zones: sorted.slice(0, 5) };
      break;
    case "bottom":
      result = { zones: sorted.slice(-5).reverse() };
      break;
    case "all":
      result = { zones: sorted, all: data ?? [] };
      break;
    default:
      result = {
        top: sorted.slice(0, 5),
        bottom: sorted.slice(-5).reverse().filter((zone) => zone.otd_pct !== null),
        all: data ?? [],
      };
  }

  return NextResponse.json(result);
});

function aggregateByZone(rows: ZonePerformanceRow[]): ZoneAggregate[] {
  const zoneMap = new Map<
    string,
    {
      zone: string;
      total_orders: number;
      delivered_count: number;
      on_time_count: number;
      total_delivery_minutes: number;
      delivery_count: number;
    }
  >();

  for (const row of rows) {
    const key = row.zone;
    const existing = zoneMap.get(key) ?? {
      zone: row.zone,
      total_orders: 0,
      delivered_count: 0,
      on_time_count: 0,
      total_delivery_minutes: 0,
      delivery_count: 0,
    };

    existing.total_orders += row.total_orders;
    existing.delivered_count += row.delivered_count;
    existing.on_time_count += row.on_time_count;
    if (row.avg_delivery_minutes) {
      existing.total_delivery_minutes += row.avg_delivery_minutes * row.delivered_count;
      existing.delivery_count += row.delivered_count;
    }

    zoneMap.set(key, existing);
  }

  return Array.from(zoneMap.values()).map((zone) => ({
    zone: zone.zone,
    total_orders: zone.total_orders,
    delivered_count: zone.delivered_count,
    on_time_count: zone.on_time_count,
    late_count: zone.delivered_count - zone.on_time_count,
    otd_pct:
      zone.delivered_count > 0
        ? Math.round((zone.on_time_count / zone.delivered_count) * 10000) / 100
        : null,
    avg_delivery_minutes:
      zone.delivery_count > 0
        ? Math.round(zone.total_delivery_minutes / zone.delivery_count)
        : null,
    volume_status: zone.total_orders < 5 ? "LOW_VOLUME" : "NORMAL",
  }));
}