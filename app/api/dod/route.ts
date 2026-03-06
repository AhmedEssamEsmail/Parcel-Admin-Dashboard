import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type DodTableRow = {
  day: string;
  total_placed: number;
  total_delivered: number;
  total_delivered_delivery_date: number;
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
  total_delivered_inc_wa_delivery_date: number;
  on_time_inc_wa: number;
  otd_pct_inc_wa: number | null;
  null_on_time_count: number;
  wa_count: number;
  wa_delivered_count: number;
  total_placed_exc_wa: number;
  total_delivered_exc_wa: number;
  total_delivered_exc_wa_delivery_date: number;
  on_time_exc_wa: number;
  otd_pct_exc_wa: number | null;
};

type ParcelKpiRow = {
  created_date_local: string;
  delivery_date_local: string | null;
  is_on_time: boolean | null;
  waiting_address: boolean | null;
  is_countable_order: boolean;
  is_delivered_status: boolean;
};

async function fetchDodSummaryFallback(
  warehouse: string | null,
  from: string,
  to: string,
): Promise<{
  rowsIncWa: DodTableRow[];
  rowsExcWa: DodTableRow[];
  waCount: number;
  waDeliveredByDay: Record<string, number>;
  nullOnTime: number;
  error?: string;
}> {
  const supabase = getSupabaseAdminClient();
  const summaryIncWa = new Map<
    string,
    {
      totalPlaced: number;
      totalDelivered: number;
      totalDeliveredDeliveryDate: number;
      onTime: number;
      late: number;
      waDelivered: number;
    }
  >();
  const summaryExcWa = new Map<
    string,
    {
      totalPlaced: number;
      totalDelivered: number;
      totalDeliveredDeliveryDate: number;
      onTime: number;
      late: number;
    }
  >();
  const pageSize = 1000;
  let offset = 0;
  let waCount = 0;
  let nullOnTime = 0;

  while (true) {
    let query = supabase
      .from("v_parcel_kpi")
      .select(
        "created_date_local,delivery_date_local,is_on_time,waiting_address,is_countable_order,is_delivered_status",
      )
      .or(
        `and(created_date_local.gte.${from},created_date_local.lte.${to}),and(delivery_date_local.gte.${from},delivery_date_local.lte.${to})`,
      );

    if (warehouse) {
      query = query.eq("warehouse_code", warehouse);
    }

    const { data, error } = await query.range(offset, offset + pageSize - 1);

    if (error) {
      return {
        rowsIncWa: [],
        rowsExcWa: [],
        waCount,
        waDeliveredByDay: {},
        nullOnTime,
        error: error.message,
      };
    }

    const rows = (data ?? []) as ParcelKpiRow[];
    for (const row of rows) {
      if (!row.is_countable_order) continue;

      const day = row.created_date_local;
      const bucketIncWa = summaryIncWa.get(day) ?? {
        totalPlaced: 0,
        totalDelivered: 0,
        totalDeliveredDeliveryDate: 0,
        onTime: 0,
        late: 0,
        waDelivered: 0,
      };

      bucketIncWa.totalPlaced += 1;

      if (row.is_delivered_status) {
        bucketIncWa.totalDelivered += 1;
        if (row.is_on_time === true) {
          bucketIncWa.onTime += 1;
        } else if (row.is_on_time === false) {
          bucketIncWa.late += 1;
        } else {
          nullOnTime += 1;
          bucketIncWa.late += 1;
        }

        if (row.waiting_address) {
          bucketIncWa.waDelivered += 1;
        }
      }

      if (row.waiting_address) {
        waCount += 1;
      }

      summaryIncWa.set(day, bucketIncWa);

      if (!row.waiting_address) {
        const bucketExcWa = summaryExcWa.get(day) ?? {
          totalPlaced: 0,
          totalDelivered: 0,
          totalDeliveredDeliveryDate: 0,
          onTime: 0,
          late: 0,
        };

        bucketExcWa.totalPlaced += 1;
        if (row.is_delivered_status) {
          bucketExcWa.totalDelivered += 1;
          if (row.is_on_time === true) {
            bucketExcWa.onTime += 1;
          } else {
            bucketExcWa.late += 1;
          }
        }

        summaryExcWa.set(day, bucketExcWa);
      }

      if (row.is_delivered_status && row.delivery_date_local) {
        const deliveryBucketIncWa = summaryIncWa.get(row.delivery_date_local) ?? {
          totalPlaced: 0,
          totalDelivered: 0,
          totalDeliveredDeliveryDate: 0,
          onTime: 0,
          late: 0,
          waDelivered: 0,
        };
        deliveryBucketIncWa.totalDeliveredDeliveryDate += 1;
        summaryIncWa.set(row.delivery_date_local, deliveryBucketIncWa);

        if (!row.waiting_address) {
          const deliveryBucketExcWa = summaryExcWa.get(row.delivery_date_local) ?? {
            totalPlaced: 0,
            totalDelivered: 0,
            totalDeliveredDeliveryDate: 0,
            onTime: 0,
            late: 0,
          };
          deliveryBucketExcWa.totalDeliveredDeliveryDate += 1;
          summaryExcWa.set(row.delivery_date_local, deliveryBucketExcWa);
        }
      }
    }

    if (rows.length < pageSize) {
      break;
    }
    offset += rows.length;
  }

  const buildRows = (
    summary: Map<
      string,
      {
        totalPlaced: number;
        totalDelivered: number;
        totalDeliveredDeliveryDate: number;
        onTime: number;
        late: number;
      }
    >,
  ): DodTableRow[] =>
    Array.from(summary.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, bucket]) => ({
      day,
      total_placed: bucket.totalPlaced ?? 0,
      total_delivered: bucket.totalDelivered ?? 0,
      total_delivered_delivery_date: bucket.totalDeliveredDeliveryDate ?? 0,
      on_time: bucket.onTime ?? 0,
      late: bucket.late ?? 0,
      otd_pct:
        (bucket.totalDelivered ?? 0) === 0
          ? null
          : Number(((bucket.onTime ?? 0) / bucket.totalDelivered).toFixed(4)),
    }));

  const waDeliveredByDay: Record<string, number> = {};
  for (const [day, bucket] of summaryIncWa.entries()) {
    waDeliveredByDay[day] = bucket.waDelivered;
  }

  return {
    rowsIncWa: buildRows(summaryIncWa),
    rowsExcWa: buildRows(summaryExcWa),
    waCount,
    waDeliveredByDay,
    nullOnTime,
  };
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
    .from("v_dod_summary_daily_rollup")
    .select(
      "warehouse_code,day,total_placed_inc_wa,total_delivered_inc_wa,total_delivered_inc_wa_delivery_date,on_time_inc_wa,otd_pct_inc_wa,null_on_time_count,wa_count,wa_delivered_count,total_placed_exc_wa,total_delivered_exc_wa,total_delivered_exc_wa_delivery_date,on_time_exc_wa,otd_pct_exc_wa",
    )
    .eq("warehouse_code", warehouseFilter ?? "ALL")
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });

  if (summaryError) {
    const fallback = await fetchDodSummaryFallback(warehouseFilter, from, to);
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error }, { status: 500 });
    }
    rowsIncWa = fallback.rowsIncWa;
    rowsExcWa = fallback.rowsExcWa;
    waCount = fallback.waCount;
    nullOnTime = fallback.nullOnTime;
    chartWaDeliveredPct = rowsIncWa.map((row) => {
      const waDelivered = fallback.waDeliveredByDay[row.day] ?? 0;
      if (row.total_delivered === 0) return 0;
      return Number(((waDelivered / row.total_delivered) * 100).toFixed(2));
    });
  } else {
    const visibleRows = (summaryData ?? []) as DodSummaryRow[];

    rowsIncWa = visibleRows.map((row) => ({
      day: row.day,
      total_placed: row.total_placed_inc_wa,
      total_delivered: row.total_delivered_inc_wa,
      total_delivered_delivery_date: row.total_delivered_inc_wa_delivery_date,
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
      total_delivered_delivery_date: row.total_delivered_exc_wa_delivery_date,
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
  const chartTotals = rowsIncWa.map((row) => row.total_placed);
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
