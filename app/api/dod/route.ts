import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

type DodRow = {
  day: string;
  total_orders: number;
  on_time: number;
  late: number;
  on_time_pct: number | null;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  if (!warehouse || !from || !to) {
    return NextResponse.json(
      { error: "warehouse, from, and to query params are required." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("v_dod_summary")
    .select("*")
    .eq("warehouse_code", warehouse)
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as DodRow[];

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
