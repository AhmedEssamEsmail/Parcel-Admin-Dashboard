import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function isMissingRelationError(
  error: { code?: string; message?: string } | null,
  relation: string,
): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  const relationLower = relation.toLowerCase();
  return (
    error.code === "PGRST205" ||
    msg.includes(`public.${relationLower}`) ||
    msg.includes(`'public.${relationLower}'`) ||
    msg.includes(relationLower)
  );
}

function emptyResponse(warning: string) {
  return {
    summary: {
      total_runs: 0,
      warning_runs: 0,
      failed_runs: 0,
    },
    recent_runs: [],
    daily: [],
    freshness: {
      stale_threshold_hours: 24,
      matrix: [],
    },
    warning,
  };
}

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
    .limit(500);

  if (warehouse && warehouse !== "ALL") {
    runsQuery = runsQuery.eq("warehouse_code", warehouse);
  }

  const { data: runs, error: runsError } = await runsQuery;
  if (runsError) {
    if (isMissingRelationError(runsError, "ingest_runs")) {
      return NextResponse.json(
        emptyResponse("Ingest observability tables are not available in this environment."),
      );
    }
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
    if (isMissingRelationError(dailyError, "v_ingest_health_daily")) {
      const rows = runs ?? [];
      return NextResponse.json({
        summary: {
          total_runs: rows.length,
          warning_runs: rows.filter((row) => (row.warning_count ?? 0) > 0).length,
          failed_runs: rows.filter((row) => row.status === "failed").length,
        },
        recent_runs: rows,
        daily: [],
        freshness: {
          stale_threshold_hours: 24,
          matrix: buildFreshnessMatrix(rows, 24),
        },
        warning: "Daily ingest health view is not available in this environment.",
      });
    }
    return NextResponse.json({ error: dailyError.message }, { status: 500 });
  }

  const rows = runs ?? [];
  const totalRuns = rows.length;
  const warningRuns = rows.filter((row) => (row.warning_count ?? 0) > 0).length;
  const failedRuns = rows.filter((row) => row.status === "failed").length;

  const staleThresholdHours = 24;

  return NextResponse.json({
    summary: {
      total_runs: totalRuns,
      warning_runs: warningRuns,
      failed_runs: failedRuns,
    },
    recent_runs: rows,
    daily: daily ?? [],
    freshness: {
      stale_threshold_hours: staleThresholdHours,
      matrix: buildFreshnessMatrix(rows, staleThresholdHours),
    },
  });
});

function buildFreshnessMatrix(rows: Array<Record<string, unknown>>, staleThresholdHours: number) {
  const latestByKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const warehouseCode = String(row.warehouse_code ?? "UNKNOWN");
    const dataset = String(row.dataset_type ?? "unknown_dataset");
    const key = `${warehouseCode}__${dataset}`;
    const existing = latestByKey.get(key);
    if (!existing) {
      latestByKey.set(key, row);
      continue;
    }

    const existingTime = new Date(String(existing.finished_at ?? existing.started_at ?? 0)).getTime();
    const currentTime = new Date(String(row.finished_at ?? row.started_at ?? 0)).getTime();
    if (currentTime > existingTime) latestByKey.set(key, row);
  }

  return Array.from(latestByKey.values()).map((row) => {
    const ts = new Date(String(row.finished_at ?? row.started_at ?? 0));
    const ageHours = Number.isNaN(ts.getTime()) ? null : Number(((Date.now() - ts.getTime()) / 3600000).toFixed(2));
    const status =
      row.status === "failed"
        ? "failed"
        : ageHours === null
          ? "unknown"
          : ageHours > staleThresholdHours
            ? "stale"
            : "fresh";

    return {
      warehouse_code: String(row.warehouse_code ?? "UNKNOWN"),
      dataset_type: String(row.dataset_type ?? "unknown_dataset"),
      last_run_at: Number.isNaN(ts.getTime()) ? null : ts.toISOString(),
      status,
      age_hours: ageHours,
    };
  });
}
