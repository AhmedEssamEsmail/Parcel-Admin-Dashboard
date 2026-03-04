import { NextRequest, NextResponse } from "next/server";

import { WAREHOUSE_CODES } from "@/lib/csv/mappings";
import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type CityPerformanceRow = {
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

type CityAggregate = {
  city: string;
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
    .from("v_city_performance")
    .select("*")
    .eq("warehouse_code", warehouse);

  if (from) query = query.gte("day", from);
  if (to) query = query.lte("day", to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allRows = (data ?? []) as CityPerformanceRow[];
  const aggregated = aggregateByCity(allRows);
  const sorted = [...aggregated].sort((a, b) => (b.otd_pct || 0) - (a.otd_pct || 0));

  let result;
  switch (view) {
    case "top":
      result = { cities: sorted.slice(0, 5) };
      break;
    case "bottom":
      result = { cities: sorted.slice(-5).reverse() };
      break;
    case "all":
      result = { cities: sorted, all: allRows };
      break;
    default:
      result = {
        top: sorted.slice(0, 5),
        bottom: sorted.slice(-5).reverse().filter((city) => city.otd_pct !== null),
        all: allRows,
      };
  }

  return NextResponse.json(result);
});

function isUnknown(value: string | null | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "unknown" || normalized === "n/a" || normalized === "na" || normalized === "-";
}

const GENERIC_LOCATION_LABELS = new Set(
  [...WAREHOUSE_CODES, "JADDAH", "SAUDI ARABIA", "KSA"].map((item) =>
    item.trim().toUpperCase(),
  ),
);

function normalizeNonUnknown(value: string | null | undefined): string | null {
  if (isUnknown(value)) return null;
  return (value ?? "").trim();
}

function isGenericLocationLabel(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return GENERIC_LOCATION_LABELS.has(normalized);
}

function getCityKey(row: CityPerformanceRow): string {
  const city = normalizeNonUnknown(row.city);
  const zone = normalizeNonUnknown(row.zone);
  const area = normalizeNonUnknown(row.area);

  const cityLooksGeneric = Boolean(
    city &&
      (isGenericLocationLabel(city) ||
        (zone !== null && city.toUpperCase() === zone.toUpperCase())),
  );

  if (city && !cityLooksGeneric) return city;
  if (area) return area;
  if (city) return city;
  if (zone) return zone;
  return "UNKNOWN";
}

function aggregateByCity(rows: CityPerformanceRow[]): CityAggregate[] {
  const cityMap = new Map<
    string,
    {
      city: string;
      total_orders: number;
      delivered_count: number;
      on_time_count: number;
      total_delivery_minutes: number;
      delivery_count: number;
    }
  >();

  for (const row of rows) {
    const key = getCityKey(row);
    const existing = cityMap.get(key) ?? {
      city: key,
      total_orders: 0,
      delivered_count: 0,
      on_time_count: 0,
      total_delivery_minutes: 0,
      delivery_count: 0,
    };

    existing.total_orders += row.total_orders;
    existing.delivered_count += row.delivered_count;
    existing.on_time_count += row.on_time_count;
    if (row.avg_delivery_minutes !== null && row.avg_delivery_minutes !== undefined) {
      existing.total_delivery_minutes += row.avg_delivery_minutes * row.delivered_count;
      existing.delivery_count += row.delivered_count;
    }

    cityMap.set(key, existing);
  }

  return Array.from(cityMap.values()).map((city) => ({
    city: city.city,
    total_orders: city.total_orders,
    delivered_count: city.delivered_count,
    on_time_count: city.on_time_count,
    late_count: city.delivered_count - city.on_time_count,
    otd_pct:
      city.delivered_count > 0
        ? Math.round((city.on_time_count / city.delivered_count) * 10000) / 100
        : null,
    avg_delivery_minutes:
      city.delivery_count > 0
        ? Math.round(city.total_delivery_minutes / city.delivery_count)
        : null,
    volume_status: city.total_orders < 5 ? "LOW_VOLUME" : "NORMAL",
  }));
}
