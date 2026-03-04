import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const severity = params.get("severity")?.trim();
  const warehouse = params.get("warehouse")?.trim();
  const checkId = params.get("check_id")?.trim();
  const resolution = params.get("resolution")?.trim().toLowerCase() ?? "open";

  const supabase = getSupabaseAdminClient();

  await supabase.rpc("detect_data_quality_issues");

  let query = supabase
    .from("data_quality_issues")
    .select("*")
    .order("detected_at", { ascending: false });

  if (resolution === "open") {
    query = query.is("resolved_at", null);
  } else if (resolution === "resolved") {
    query = query.not("resolved_at", "is", null);
  }

  if (severity) {
    query = query.eq("severity", severity);
  }
  if (warehouse) {
    query = query.eq("warehouse_code", warehouse);
  }
  if (checkId) {
    query = query.eq("check_id", checkId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const grouped = {
    critical: rows.filter((issue) => issue.severity === "critical"),
    warning: rows.filter((issue) => issue.severity === "warning"),
    info: rows.filter((issue) => issue.severity === "info"),
  };

  return NextResponse.json({
    summary: {
      critical_count: grouped.critical.length,
      warning_count: grouped.warning.length,
      info_count: grouped.info.length,
    },
    issues: grouped,
    all: rows,
  });
});

export const PATCH = withRateLimit(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as
    | { issue_id?: string; resolved_by?: string }
    | null;

  const issueId = body?.issue_id;
  const resolvedBy = body?.resolved_by || "system";

  if (!issueId) {
    return NextResponse.json({ error: "issue_id is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("data_quality_issues")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq("id", issueId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
