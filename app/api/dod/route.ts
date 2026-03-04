import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type DodTableRow = {
  day: string;
  total_placed: number;
  total_delivered: number;
  on_time: number;
  late: number;
  otd_pct: number | null;
};

type DodResponse = {
  rows_inc_wa: DodTableRow[];
  rows_exc_wa: DodTableRow[];
  wa_count: number;
  null_on_time_count: number;
  series: {
    labels: string[];
    totalOrders: number[];
    onTimePct: number[];
    waDeliveredPct: number[];
  };
};

type DodSummaryRow = {
  warehouse_code: string;
  day: string;
  total_placed_inc_wa: number;
  total_delivered_inc_wa: number;
  on_time_inc_wa: number;
  otd_pct_inc_wa: number | null;
  null_on_time_count: number;
  wa_count: number;
  wa_delivered_count: number;
  total_placed_exc_wa: number;
  total_delivered_exc_wa: number;
  on_time_exc_wa: number;
  otd_pct_exc_wa: number | null;
};

type ParcelKpiRow = {
  created_date_local: string;
  is_on_time: boolean | null;
  waiting_address: boolean | null;
  delivered_ts: string | null;
};

async function fetchDodSummaryFallback(
  warehouse: string | null,
  from: string,
  to: string,
): Promise<{
  rows: DodTableRow[];
  waCount: number;
  waDeliveredByDay: Record<string, number>;
  nullOnTime: number;
  error?: string;
}> {
  const supabase = getSupabaseAdminClient();
  const summary = new Map<
    string,
    { totalPlaced: number; totalDelivered: number; onTime: number; late: number; waDelivered: number }
  >();
  const pageSize = 1000;
  let offset = 0;
  let waCount = 0;
  let nullOnTime = 0;

  while (true) {
    let query = supabase
      .from("v_parcel_kpi")
      .select("created_date_local,is_on_time,waiting_address,delivered_ts")
      .gte("created_date_local", from)
      .lte("created_date_local", to);

    if (warehouse) {
      query = query.eq("warehouse_code", warehouse);
    }

    const { data, error } = await query.range(offset, offset + pageSize - 1);

    if (error) {
      return { rows: [], waCount, waDeliveredByDay: {}, nullOnTime, error: error.message };
    }

    const rows = (data ?? []) as ParcelKpiRow[];
    for (const row of rows) {
      const day = row.created_date_local;
      const bucket = summary.get(day) ?? {
        totalPlaced: 0,
        totalDelivered: 0,
        onTime: 0,
        late: 0,
        waDelivered: 0,
      };

      bucket.totalPlaced += 1;

      if (row.delivered_ts !== null) {
        bucket.totalDelivered += 1;
        if (row.is_on_time === true) {
          bucket.onTime += 1;
        } else if (row.is_on_time === false) {
          bucket.late += 1;
        } else {
          nullOnTime += 1;
        }

        if (row.waiting_address) {
          bucket.waDelivered += 1;
        }
      } else if (row.is_on_time === null) {
        nullOnTime += 1;
      }

      if (row.waiting_address) {
        waCount += 1;
      }

      summary.set(day, bucket);
    }

    if (rows.length < pageSize) {
      break;
    }
    offset += rows.length;
  }

  const dodRows: DodTableRow[] = Array.from(summary.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, bucket]) => ({
      day,
      total_placed: bucket.totalPlaced,
      total_delivered: bucket.totalDelivered,
      on_time: bucket.onTime,
      late: bucket.late,
      otd_pct:
        bucket.totalDelivered === 0
          ? null
          : Number((bucket.onTime / bucket.totalDelivered).toFixed(4)),
    }));

  const waDeliveredByDay: Record<string, number> = {};
  for (const [day, bucket] of summary.entries()) {
    waDeliveredByDay[day] = bucket.waDelivered;
  }

  return { rows: dodRows, waCount, waDeliveredByDay, nullOnTime };
}

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase() ?? "ALL";
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query params are required." },
      { status: 400 },
    );
  }

  const warehouseFilter = warehouse === "ALL" ? null : warehouse;
  const supabase = getSupabaseAdminClient();

  let rowsIncWa: DodTableRow[] = [];
  let rowsExcWa: DodTableRow[] = [];
  let waCount = 0;
  let nullOnTime = 0;
  let chartWaDeliveredPct: number[] = [];

  const { data: summaryData, error: summaryError } = await supabase
    .from("v_dod_summary")
    .select(
      "warehouse_code,day,total_placed_inc_wa,total_delivered_inc_wa,on_time_inc_wa,otd_pct_inc_wa,null_on_time_count,wa_count,wa_delivered_count,total_placed_exc_wa,total_delivered_exc_wa,on_time_exc_wa,otd_pct_exc_wa",
    )
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });

  if (summaryError) {
    const fallback = await fetchDodSummaryFallback(warehouseFilter, from, to);
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error }, { status: 500 });
    }
    rowsIncWa = fallback.rows;
    rowsExcWa = fallback.rows;
    waCount = fallback.waCount;
    nullOnTime = fallback.nullOnTime;
    chartWaDeliveredPct = rowsIncWa.map((row) => {
      const waDelivered = fallback.waDeliveredByDay[row.day] ?? 0;
      if (row.total_delivered === 0) return 0;
      return Number(((waDelivered / row.total_delivered) * 100).toFixed(2));
    });
  } else {
    const filteredRows = (summaryData ?? []) as DodSummaryRow[];
    const visibleRows = warehouseFilter
      ? filteredRows.filter((row) => row.warehouse_code === warehouseFilter)
      : filteredRows;

    rowsIncWa = visibleRows.map((row) => ({
      day: row.day,
      total_placed: row.total_placed_inc_wa,
      total_delivered: row.total_delivered_inc_wa,
      on_time: row.on_time_inc_wa,
      late: row.total_delivered_inc_wa - row.on_time_inc_wa,
      otd_pct:
        row.otd_pct_inc_wa === null || row.otd_pct_inc_wa === undefined
          ? null
          : Number(row.otd_pct_inc_wa) / 100,
    }));

    rowsExcWa = visibleRows.map((row) => ({
      day: row.day,
      total_placed: row.total_placed_exc_wa,
      total_delivered: row.total_delivered_exc_wa,
      on_time: row.on_time_exc_wa,
      late: row.total_delivered_exc_wa - row.on_time_exc_wa,
      otd_pct:
        row.otd_pct_exc_wa === null || row.otd_pct_exc_wa === undefined
          ? null
          : Number(row.otd_pct_exc_wa) / 100,
    }));

    waCount = visibleRows.reduce((total, row) => total + (row.wa_count ?? 0), 0);
    nullOnTime = visibleRows.reduce((total, row) => total + (row.null_on_time_count ?? 0), 0);
    chartWaDeliveredPct = visibleRows.map((row) => {
      if (!row.total_delivered_inc_wa) return 0;
      return Number((((row.wa_delivered_count ?? 0) / row.total_delivered_inc_wa) * 100).toFixed(2));
    });
  }

  const chartLabels = rowsIncWa.map((row) => row.day);
  const chartTotals = rowsIncWa.map((row) => row.total_delivered);
  const chartOnTimePct = rowsIncWa.map((row) => (row.otd_pct ?? 0) * 100);

  const response: DodResponse = {
    rows_inc_wa: rowsIncWa,
    rows_exc_wa: rowsExcWa,
    wa_count: waCount,
    null_on_time_count: nullOnTime,
    series: {
      labels: chartLabels,
      totalOrders: chartTotals,
      onTimePct: chartOnTimePct,
      waDeliveredPct: chartWaDeliveredPct,
    },
  };

  return NextResponse.json(response);
});
