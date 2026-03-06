import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type PeriodRow = {
  warehouse_code: string;
  total_placed: number;
  total_delivered: number;
  total_delivered_delivery_date: number;
  on_time: number;
  late: number | null;
  wa_count: number | null;
  wa_delivered_count: number | null;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  week_start?: string;
  week_label?: string;
  month_start?: string;
  month_label?: string;
};

type PeriodChange = {
  total_placed: { value: number; pct: number };
  otd_pct: { value: number; direction: "up" | "down" };
  avg_delivery_minutes: { value: number; direction: "improved" | "worse" };
};

type PeriodWithChanges = Omit<PeriodRow, "late"> & {
  late: number;
  changes: PeriodChange | null;
};

type WarehouseGroup = {
  warehouse_code: string;
  warehouse_name: string;
  periods: PeriodWithChanges[];
};

function withLateFallback(row: PeriodRow): PeriodWithChanges {
  const late = row.late ?? Math.max((row.total_delivered ?? 0) - (row.on_time ?? 0), 0);
  return {
    ...row,
    late,
    changes: null,
  };
}

function addPeriodChanges(data: PeriodRow[]): PeriodWithChanges[] {
  const normalized = data.map(withLateFallback);

  return normalized.map((row, idx) => {
    if (idx === normalized.length - 1) {
      return { ...row, changes: null };
    }

    const prev = normalized[idx + 1];
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

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const requestedPeriodType = params.get("periodType")?.trim().toLowerCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const periodType = requestedPeriodType === "month" ? "month" : "week";
  const hasDateRange = Boolean(from || to);
  const limit = Math.min(
    24,
    Math.max(1, Number.parseInt(params.get("limit") || "6", 10) || 6),
  );

  if (!warehouse) {
    return NextResponse.json(
      { error: "warehouse query param is required" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const viewName = periodType === "month" ? "v_mom_summary" : "v_wow_summary";
  const dateColumn = periodType === "month" ? "month_start" : "week_start";

  const fastRpcResult = hasDateRange
    ? { data: null, error: { message: "Skipped fast path because from/to filters are applied." } }
    : await supabase.rpc("get_wow_summary_fast", {
        p_warehouse_code: warehouse,
        p_period_type: periodType,
        p_limit: limit,
      });

  const fastRows = fastRpcResult.data as Array<Record<string, unknown>> | null;
  const fastError = fastRpcResult.error;

  if (!hasDateRange && !fastError && Array.isArray(fastRows) && fastRows.length > 0) {
    const adaptedRows = fastRows.map((row) => ({
      warehouse_code: row.warehouse_code,
      total_placed: Number(row.total_placed ?? 0),
      total_delivered: Number(row.total_delivered ?? 0),
      total_delivered_delivery_date: Number(row.total_delivered_delivery_date ?? 0),
      on_time: Number(row.on_time ?? 0),
      late: Number(row.late ?? 0),
      wa_count: Number(row.wa_count ?? 0),
      wa_delivered_count: Number(row.wa_delivered_count ?? 0),
      otd_pct: row.otd_pct === null ? null : Number(row.otd_pct),
      avg_delivery_minutes:
        row.avg_delivery_minutes === null ? null : Number(row.avg_delivery_minutes),
      week_start: periodType === "week" ? row.period_start : undefined,
      week_label: periodType === "week" ? row.period_label : undefined,
      month_start: periodType === "month" ? row.period_start : undefined,
      month_label: periodType === "month" ? row.period_label : undefined,
    })) as PeriodRow[];

    if (warehouse !== "ALL") {
      const periods = addPeriodChanges(adaptedRows.slice(0, limit));
      return NextResponse.json({ period_type: periodType, periods });
    }

    const [{ data: warehouseData, error: warehouseError }] = await Promise.all([
      supabase.from("warehouses").select("code,name"),
    ]);

    if (warehouseError) {
      return NextResponse.json({ error: warehouseError.message }, { status: 500 });
    }

    const warehouseNameByCode = new Map<string, string>(
      (warehouseData ?? []).map((item) => [item.code, item.name]),
    );
    const grouped = new Map<string, PeriodRow[]>();
    for (const row of adaptedRows) {
      const bucket = grouped.get(row.warehouse_code) ?? [];
      bucket.push(row);
      grouped.set(row.warehouse_code, bucket);
    }

    const groups: WarehouseGroup[] = Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([warehouseCode, rows]) => ({
        warehouse_code: warehouseCode,
        warehouse_name: warehouseNameByCode.get(warehouseCode) ?? warehouseCode,
        periods: addPeriodChanges(rows.slice(0, limit)),
      }));

    return NextResponse.json({
      period_type: periodType,
      periods: [],
      groups,
    });
  }

  if (warehouse !== "ALL") {
    let query = supabase
      .from(viewName)
      .select("*")
      .eq("warehouse_code", warehouse)
      .order(dateColumn, { ascending: false });

    if (from) {
      query = query.gte(dateColumn, from);
    }
    if (to) {
      query = query.lte(dateColumn, to);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const periods = addPeriodChanges((data ?? []) as PeriodRow[]);
    return NextResponse.json({
      period_type: periodType,
      periods,
    });
  }

  const [{ data: periodData, error: periodError }, { data: warehouseData, error: warehouseError }] =
    await Promise.all([
      (async () => {
        let query = supabase
          .from(viewName)
          .select("*")
          .order("warehouse_code", { ascending: true })
          .order(dateColumn, { ascending: false });

        if (from) {
          query = query.gte(dateColumn, from);
        }
        if (to) {
          query = query.lte(dateColumn, to);
        }

        return query;
      })(),
      supabase.from("warehouses").select("code,name"),
    ]);

  if (periodError) {
    return NextResponse.json({ error: periodError.message }, { status: 500 });
  }

  if (warehouseError) {
    return NextResponse.json({ error: warehouseError.message }, { status: 500 });
  }

  const warehouseNameByCode = new Map<string, string>(
    (warehouseData ?? []).map((item) => [item.code, item.name]),
  );

  const grouped = new Map<string, PeriodRow[]>();
  for (const row of (periodData ?? []) as PeriodRow[]) {
    const bucket = grouped.get(row.warehouse_code) ?? [];
    bucket.push(row);
    grouped.set(row.warehouse_code, bucket);
  }

  const groups: WarehouseGroup[] = Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([warehouseCode, rows]) => ({
      warehouse_code: warehouseCode,
      warehouse_name: warehouseNameByCode.get(warehouseCode) ?? warehouseCode,
      periods: addPeriodChanges(rows.slice(0, limit)),
    }));

  return NextResponse.json({
    period_type: periodType,
    periods: [],
    groups,
  });
});
