import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  const supabase = getSupabaseAdminClient();
  const dailyWarehouse = warehouse && warehouse !== "ALL" ? warehouse : "ALL";

  let dailyQuery = supabase
    .from("v_promise_reliability_daily_rollup")
    .select("*")
    .eq("warehouse_code", dailyWarehouse)
    .order("day", { ascending: true });

  let detailedQuery = supabase
    .from("v_promise_reliability_daily")
    .select("*")
    .order("day", { ascending: true });

  if (warehouse && warehouse !== "ALL") {
    detailedQuery = detailedQuery.eq("warehouse_code", warehouse);
  }

  if (from) {
    dailyQuery = dailyQuery.gte("day", from);
    detailedQuery = detailedQuery.gte("day", from);
  }

  if (to) {
    dailyQuery = dailyQuery.lte("day", to);
    detailedQuery = detailedQuery.lte("day", to);
  }

  const [{ data: dailyData, error: dailyError }, { data: detailedData, error: detailedError }] =
    await Promise.all([dailyQuery, detailedQuery]);

  if (dailyError) {
    return NextResponse.json({ error: dailyError.message }, { status: 500 });
  }

  if (detailedError) {
    return NextResponse.json({ error: detailedError.message }, { status: 500 });
  }

  const dailyRows = dailyData ?? [];
  const detailedRows = detailedData ?? [];

  return NextResponse.json({
    rows: detailedRows,
    daily_rows: dailyRows,
    detailed_rows: detailedRows,
  });
});
