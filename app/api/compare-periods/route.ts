import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type CompareRequest = {
  warehouse: string;
  period_a_start: string;
  period_a_end: string;
  period_b_start: string;
  period_b_end: string;
};

export const POST = withRateLimit(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as CompareRequest | null;
  const warehouse = body?.warehouse?.trim().toUpperCase();
  const { period_a_start, period_a_end, period_b_start, period_b_end } = body ?? {};

  if (!warehouse || !period_a_start || !period_a_end || !period_b_start || !period_b_end) {
    return NextResponse.json(
      {
        error:
          "All fields required: warehouse, period_a_start, period_a_end, period_b_start, period_b_end",
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();

  try {
    const [periodA, periodB] = await Promise.all([
      fetchPeriodData(supabase, warehouse, period_a_start, period_a_end),
      fetchPeriodData(supabase, warehouse, period_b_start, period_b_end),
    ]);

    const comparison = calculateComparison(periodA, periodB);

    return NextResponse.json({
      period_a: { start: period_a_start, end: period_a_end, ...periodA },
      period_b: { start: period_b_start, end: period_b_end, ...periodB },
      comparison,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compare periods." },
      { status: 500 },
    );
  }
});

type PeriodStats = {
  total_placed: number;
  total_delivered: number;
  on_time: number;
  late: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  wa_count: number;
};

async function fetchPeriodData(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  warehouse: string,
  from: string,
  to: string,
): Promise<PeriodStats> {
  const { data, error } = await supabase
    .from("v_parcel_kpi")
    .select("parcel_id, is_on_time, delivered_ts, order_ts, waiting_address")
    .eq("warehouse_code", warehouse)
    .gte("created_date_local", from)
    .lte("created_date_local", to);

  if (error) throw error;

  const rows = data ?? [];
  const delivered = rows.filter((row) => row.delivered_ts !== null);
  const onTime = delivered.filter((row) => row.is_on_time === true);
  const waOrders = rows.filter((row) => row.waiting_address === true);

  const deliveryTimes = delivered
    .filter((row) => row.delivered_ts > row.order_ts)
    .map((row) => {
      const ms = new Date(row.delivered_ts).getTime() - new Date(row.order_ts).getTime();
      return ms / 60000;
    });

  const avgDeliveryTime =
    deliveryTimes.length > 0
      ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      : null;

  return {
    total_placed: rows.length,
    total_delivered: delivered.length,
    on_time: onTime.length,
    late: delivered.length - onTime.length,
    otd_pct:
      delivered.length > 0
        ? Math.round((onTime.length / delivered.length) * 10000) / 100
        : null,
    avg_delivery_minutes: avgDeliveryTime ? Math.round(avgDeliveryTime) : null,
    wa_count: waOrders.length,
  };
}

function calculateComparison(periodA: PeriodStats, periodB: PeriodStats) {
  return {
    total_placed: {
      absolute: periodB.total_placed - periodA.total_placed,
      pct:
        periodA.total_placed > 0
          ? Math.round(((periodB.total_placed - periodA.total_placed) / periodA.total_placed) * 100)
          : 0,
    },
    total_delivered: {
      absolute: periodB.total_delivered - periodA.total_delivered,
      pct:
        periodA.total_delivered > 0
          ? Math.round(((periodB.total_delivered - periodA.total_delivered) / periodA.total_delivered) * 100)
          : 0,
    },
    otd_pct: {
      absolute: (periodB.otd_pct || 0) - (periodA.otd_pct || 0),
      improved: (periodB.otd_pct || 0) >= (periodA.otd_pct || 0),
    },
    avg_delivery_minutes: {
      absolute: (periodB.avg_delivery_minutes || 0) - (periodA.avg_delivery_minutes || 0),
      improved: (periodB.avg_delivery_minutes || 0) <= (periodA.avg_delivery_minutes || 0),
    },
  };
}