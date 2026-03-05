import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ParcelRow = {
  delivered_ts: string | null;
  delivered_local: string | null;
  deadline_local: string | null;
};

function minutesLate(row: ParcelRow): number {
  if (!row.delivered_ts || !row.delivered_local || !row.deadline_local) return 0;
  const delivered = new Date(row.delivered_local).getTime();
  const deadline = new Date(row.deadline_local).getTime();
  if (Number.isNaN(delivered) || Number.isNaN(deadline)) return 0;
  return Math.max(0, Math.round((delivered - deadline) / 60000));
}

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("v_parcel_kpi")
    .select("warehouse_code,created_date_local,delivered_ts,delivered_local,deadline_local")
    .gte("created_date_local", from)
    .lte("created_date_local", to)
    .not("delivered_ts", "is", null)
    .not("deadline_local", "is", null)
    .limit(30000);

  if (warehouse && warehouse !== "ALL") query = query.eq("warehouse_code", warehouse);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bucketCounts = {
    "0-30m": 0,
    "30-60m": 0,
    "1-2h": 0,
    "2h+": 0,
  };

  let deliveredWithPromise = 0;
  let onTime = 0;
  let late = 0;

  for (const row of (data ?? []) as Array<ParcelRow>) {
    deliveredWithPromise += 1;
    const lateMinutes = minutesLate(row);
    if (lateMinutes <= 0) {
      onTime += 1;
      continue;
    }

    late += 1;
    if (lateMinutes < 30) bucketCounts["0-30m"] += 1;
    else if (lateMinutes < 60) bucketCounts["30-60m"] += 1;
    else if (lateMinutes < 120) bucketCounts["1-2h"] += 1;
    else bucketCounts["2h+"] += 1;
  }

  const buckets = Object.entries(bucketCounts).map(([bucket, count]) => ({
    bucket,
    count,
    pct_late: late > 0 ? Number(((count / late) * 100).toFixed(2)) : 0,
  }));

  return NextResponse.json({
    summary: {
      delivered_with_promise: deliveredWithPromise,
      on_time: onTime,
      late,
    },
    buckets,
  });
});
