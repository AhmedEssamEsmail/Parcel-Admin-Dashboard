import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ExceptionRow = {
  id: string;
  status: string;
  detected_at: string;
  resolved_at: string | null;
  aging_hours: number;
};

type ActionRow = {
  exception_id: string;
  action: string;
  created_at: string;
};

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  const supabase = getSupabaseAdminClient();

  let exceptionsQuery = supabase
    .from("v_exception_aging")
    .select("id,status,detected_at,resolved_at,aging_hours")
    .order("detected_at", { ascending: false })
    .limit(1000);

  if (warehouse && warehouse !== "ALL") exceptionsQuery = exceptionsQuery.eq("warehouse_code", warehouse);
  if (from) exceptionsQuery = exceptionsQuery.gte("detected_at", `${from}T00:00:00.000Z`);
  if (to) exceptionsQuery = exceptionsQuery.lte("detected_at", `${to}T23:59:59.999Z`);

  const { data: exceptions, error } = await exceptionsQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const exceptionRows = (exceptions ?? []) as ExceptionRow[];
  const ids = exceptionRows.map((row) => row.id);

  let actions: ActionRow[] = [];
  if (ids.length > 0) {
    const { data: actionRows, error: actionsError } = await supabase
      .from("exception_actions")
      .select("exception_id,action,created_at")
      .in("exception_id", ids)
      .order("created_at", { ascending: true });

    if (actionsError) return NextResponse.json({ error: actionsError.message }, { status: 500 });
    actions = (actionRows ?? []) as ActionRow[];
  }

  const actionsByException = new Map<string, ActionRow[]>();
  actions.forEach((action) => {
    const list = actionsByException.get(action.exception_id) ?? [];
    list.push(action);
    actionsByException.set(action.exception_id, list);
  });

  const mttaSamples: number[] = [];
  const mttrSamples: number[] = [];

  exceptionRows.forEach((row) => {
    const detected = new Date(row.detected_at).getTime();
    const rowActions = actionsByException.get(row.id) ?? [];

    const acknowledged = rowActions.find((action) => action.action === "acknowledged");
    if (acknowledged) {
      const ackTs = new Date(acknowledged.created_at).getTime();
      if (!Number.isNaN(ackTs) && !Number.isNaN(detected)) {
        mttaSamples.push((ackTs - detected) / 3600000);
      }
    }

    if (row.resolved_at) {
      const resolved = new Date(row.resolved_at).getTime();
      if (!Number.isNaN(resolved) && !Number.isNaN(detected)) {
        mttrSamples.push((resolved - detected) / 3600000);
      }
    }
  });

  const avg = (values: number[]) =>
    values.length ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)) : null;

  const agingBuckets = {
    "0-24h": 0,
    "24-72h": 0,
    "72h+": 0,
  };

  exceptionRows.forEach((row) => {
    const age = Number(row.aging_hours ?? 0);
    if (age < 24) agingBuckets["0-24h"] += 1;
    else if (age < 72) agingBuckets["24-72h"] += 1;
    else agingBuckets["72h+"] += 1;
  });

  return NextResponse.json({
    mtta_hours: avg(mttaSamples),
    mttr_hours: avg(mttrSamples),
    aging_buckets: Object.entries(agingBuckets).map(([bucket, count]) => ({ bucket, count })),
  });
});
