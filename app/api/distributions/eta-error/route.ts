import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("v_parcel_kpi")
    .select(
      "warehouse_code,created_date_local,delivered_ts,delivered_local,deadline_local,is_countable_order,is_delivered_status",
    )
    .gte("created_date_local", from)
    .lte("created_date_local", to)
    .eq("is_countable_order", true)
    .eq("is_delivered_status", true)
    .not("delivered_ts", "is", null)
    .not("deadline_local", "is", null)
    .limit(30000);

  if (warehouse && warehouse !== "ALL") query = query.eq("warehouse_code", warehouse);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const signedBins = [
    { label: "<-60m", min: Number.NEGATIVE_INFINITY, max: -60, count: 0 },
    { label: "-60..0m", min: -60, max: 0, count: 0 },
    { label: "0..30m", min: 0, max: 30, count: 0 },
    { label: "30..60m", min: 30, max: 60, count: 0 },
    { label: ">=60m", min: 60, max: Number.POSITIVE_INFINITY, count: 0 },
  ];

  const absoluteBins = [
    { label: "0-10m", min: 0, max: 10, count: 0 },
    { label: "10-30m", min: 10, max: 30, count: 0 },
    { label: "30-60m", min: 30, max: 60, count: 0 },
    { label: "60m+", min: 60, max: Number.POSITIVE_INFINITY, count: 0 },
  ];

  for (const row of data ?? []) {
    const delivered = new Date(String(row.delivered_local)).getTime();
    const deadline = new Date(String(row.deadline_local)).getTime();
    if (Number.isNaN(delivered) || Number.isNaN(deadline)) continue;

    const signed = Math.round((delivered - deadline) / 60000);
    const absolute = Math.abs(signed);

    const signedBin = signedBins.find((item) => signed >= item.min && signed < item.max);
    if (signedBin) signedBin.count += 1;

    const absBin = absoluteBins.find((item) => absolute >= item.min && absolute < item.max);
    if (absBin) absBin.count += 1;
  }

  return NextResponse.json({ signed_bins: signedBins, absolute_bins: absoluteBins });
});
