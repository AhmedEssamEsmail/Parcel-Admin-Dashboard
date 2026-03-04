import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type PeriodRow = {
  total_placed: number;
  total_delivered: number;
  on_time: number;
  late: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  week_start?: string;
  week_label?: string;
  month_start?: string;
  month_label?: string;
};

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const periodType = params.get("periodType")?.trim() || "week";
  const limit = Number.parseInt(params.get("limit") || "4", 10);

  if (!warehouse) {
    return NextResponse.json(
      { error: "warehouse query param is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const viewName = periodType === "month" ? "v_mom_summary" : "v_wow_summary";
  const dateColumn = periodType === "month" ? "month_start" : "week_start";

  const { data, error } = await supabase
    .from(viewName)
    .select("*")
    .eq("warehouse_code", warehouse)
    .order(dateColumn, { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const withChanges = addPeriodChanges(data ?? []);

  return NextResponse.json({
    period_type: periodType,
    periods: withChanges,
  });
});

type PeriodChange = {
  total_placed: { value: number; pct: number };
  otd_pct: { value: number; direction: "up" | "down" };
  avg_delivery_minutes: { value: number; direction: "improved" | "worse" };
};

type PeriodWithChanges = PeriodRow & { changes: PeriodChange | null };

function addPeriodChanges(data: PeriodRow[]): PeriodWithChanges[] {
  return data.map((row, idx) => {
    if (idx === data.length - 1) {
      return { ...row, changes: null };
    }

    const prev = data[idx + 1];
    return {
      ...row,
      changes: {
        total_placed: {
          value: row.total_placed - prev.total_placed,
          pct:
            prev.total_placed > 0
              ? Math.round(((row.total_placed - prev.total_placed) / prev.total_placed) * 100)
              : 0,
        },
        otd_pct: {
          value: (row.otd_pct || 0) - (prev.otd_pct || 0),
          direction: (row.otd_pct || 0) >= (prev.otd_pct || 0) ? "up" : "down",
        },
        avg_delivery_minutes: {
          value: (row.avg_delivery_minutes || 0) - (prev.avg_delivery_minutes || 0),
          direction:
            (row.avg_delivery_minutes || 0) <= (prev.avg_delivery_minutes || 0)
              ? "improved"
              : "worse",
        },
      },
    };
  });
}