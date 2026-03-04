import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const days = Math.min(30, Math.max(1, Number.parseInt(params.get("days") ?? "7", 10) || 7));

  const supabase = getSupabaseAdminClient();
  const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let runsQuery = supabase
    .from("ingest_runs")
    .select("*")
    .gte("started_at", cutoffIso)
    .order("started_at", { ascending: false })
    .limit(100);

  if (warehouse && warehouse !== "ALL") {
    runsQuery = runsQuery.eq("warehouse_code", warehouse);
  }

  const { data: runs, error: runsError } = await runsQuery;
  if (runsError) {
    return NextResponse.json({ error: runsError.message }, { status: 500 });
  }

  let summaryQuery = supabase
    .from("v_ingest_health_daily")
    .select("*")
    .gte("day", new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .order("day", { ascending: true });

  if (warehouse && warehouse !== "ALL") {
    summaryQuery = summaryQuery.eq("warehouse_code", warehouse);
  }

  const { data: daily, error: dailyError } = await summaryQuery;
  if (dailyError) {
    return NextResponse.json({ error: dailyError.message }, { status: 500 });
  }

  const rows = runs ?? [];
  const totalRuns = rows.length;
  const warningRuns = rows.filter((row) => (row.warning_count ?? 0) > 0).length;
  const failedRuns = rows.filter((row) => row.status === "failed").length;

  return NextResponse.json({
    summary: {
      total_runs: totalRuns,
      warning_runs: warningRuns,
      failed_runs: failedRuns,
    },
    recent_runs: rows,
    daily: daily ?? [],
  });
});
