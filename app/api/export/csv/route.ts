import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { generateCsv } from "@/lib/utils/export";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ExportRow = Record<string, string | number | boolean | null>;

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const type = params.get("type")?.trim() || "dashboard";
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  if (!warehouse) {
    return NextResponse.json({ error: "warehouse is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  let data: ExportRow[] = [];
  let filename = "export.csv";

  switch (type) {
    case "zone":
      data = await fetchZoneData(supabase, warehouse, from, to);
      filename = `zone_performance_${warehouse}_${from || "all"}_${to || "all"}.csv`;
      break;
    case "wow":
      data = await fetchWowData(supabase, warehouse);
      filename = `weekly_summary_${warehouse}.csv`;
      break;
    case "comparison":
      data = await fetchComparisonData(supabase, warehouse, from, to);
      filename = `comparison_${warehouse}_${from || "all"}_${to || "all"}.csv`;
      break;
    default:
      data = await fetchDashboardData(supabase, warehouse, from, to);
      filename = `dashboard_${warehouse}_${from || "all"}_${to || "all"}.csv`;
  }

  const csv = generateCsv(data, type, warehouse, from, to);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

async function fetchZoneData(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  warehouse: string,
  from?: string | null,
  to?: string | null,
) {
  let query = supabase
    .from("v_zone_performance")
    .select("*")
    .eq("warehouse_code", warehouse);

  if (from) query = query.gte("day", from);
  if (to) query = query.lte("day", to);

  const { data, error } = await query;
  if (error) throw error;

  return data ?? [];
}

async function fetchWowData(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  warehouse: string,
) {
  const { data, error } = await supabase
    .from("v_wow_summary")
    .select("*")
    .eq("warehouse_code", warehouse)
    .order("week_start", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function fetchDashboardData(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  warehouse: string,
  from?: string | null,
  to?: string | null,
) {
  let query = supabase
    .from("v_dod_summary")
    .select("*")
    .eq("warehouse_code", warehouse);

  if (from) query = query.gte("day", from);
  if (to) query = query.lte("day", to);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function fetchComparisonData(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  warehouse: string,
  from?: string | null,
  to?: string | null,
) {
  if (!from || !to) return [];

  const { data, error } = await supabase
    .from("v_parcel_kpi")
    .select("parcel_id, is_on_time, delivered_ts, order_ts_utc, waiting_address")
    .eq("warehouse_code", warehouse)
    .gte("created_date_local", from)
    .lte("created_date_local", to);

  if (error) throw error;
  return data ?? [];
}
