import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

type DodRow = {
  day: string;
  total_orders: number;
  on_time: number;
  late: number;
  on_time_pct: number | null;
};

type DodRpcRow = {
  day: string;
  total_orders: number;
  on_time: number;
  late: number;
  on_time_pct: number | null;
};

type ParcelKpiRow = {
  created_date_local: string;
  is_on_time: boolean | null;
};

async function loadDodByPaging(
  warehouse: string | null,
  from: string,
  to: string,
): Promise<{ rows: DodRow[]; error?: string }> {
  const supabase = getSupabaseAdminClient();
  const summary = new Map<string, { total: number; onTime: number; late: number }>();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    let query = supabase
      .from("v_parcel_kpi")
      .select("created_date_local,is_on_time")
      .gte("created_date_local", from)
      .lte("created_date_local", to)
      .not("delivered_ts", "is", null);

    if (warehouse) {
      query = query.eq("warehouse_code", warehouse);
    }

    const { data, error } = await query.range(offset, offset + pageSize - 1);

    if (error) {
      return { rows: [], error: error.message };
    }

    const rows = (data ?? []) as ParcelKpiRow[];
    for (const row of rows) {
      const day = row.created_date_local;
      const bucket = summary.get(day) ?? { total: 0, onTime: 0, late: 0 };

      bucket.total += 1;
      if (row.is_on_time === true) {
        bucket.onTime += 1;
      } else if (row.is_on_time === false) {
        bucket.late += 1;
      }

      summary.set(day, bucket);
    }

    if (rows.length < pageSize) {
      break;
    }
    offset += rows.length;
  }

  const dodRows: DodRow[] = Array.from(summary.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, bucket]) => ({
      day,
      total_orders: bucket.total,
      on_time: bucket.onTime,
      late: bucket.late,
      on_time_pct: bucket.total === 0 ? null : bucket.onTime / bucket.total,
    }));

  return { rows: dodRows };
}

export async function GET(request: NextRequest) {
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

  const { data: rpcData, error: rpcError } = await supabase.rpc("get_dod_summary_fast", {
    p_warehouse_code: warehouseFilter,
    p_from: from,
    p_to: to,
  });

  let rows: DodRow[] = [];

  if (rpcError) {
    const fallback = await loadDodByPaging(warehouseFilter, from, to);
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error }, { status: 500 });
    }
    rows = fallback.rows;
  } else {
    rows = ((rpcData ?? []) as DodRpcRow[]).map((row) => ({
      day: row.day,
      total_orders: row.total_orders,
      on_time: row.on_time,
      late: row.late,
      on_time_pct:
        row.on_time_pct === null || row.on_time_pct === undefined
          ? null
          : Number(row.on_time_pct),
    }));
  }

  return NextResponse.json({
    rows,
    series: {
      labels: rows.map((row) => row.day),
      totalOrders: rows.map((row) => row.total_orders),
      onTimePct: rows.map((row) => (row.on_time_pct ?? 0) * 100),
      onTime: rows.map((row) => row.on_time),
      late: rows.map((row) => row.late),
    },
  });
}
