import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const severity = params.get("severity")?.trim().toLowerCase();
  const status = params.get("status")?.trim().toLowerCase();

  const supabase = getSupabaseAdminClient();
  await supabase.rpc("refresh_delivery_exceptions", { p_days: 14 });

  let query = supabase.from("v_exception_aging").select("*").order("detected_at", { ascending: false });
  if (warehouse && warehouse !== "ALL") query = query.eq("warehouse_code", warehouse);
  if (from) query = query.gte("detected_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("detected_at", `${to}T23:59:59.999Z`);
  if (severity && severity !== "all") query = query.eq("severity", severity);
  if (status && status !== "all") query = query.eq("status", status);

  const { data: rows, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let summaryQuery = supabase.from("v_exceptions_summary_daily").select("*").order("day", { ascending: true });
  if (warehouse && warehouse !== "ALL") summaryQuery = summaryQuery.eq("warehouse_code", warehouse);
  if (from) summaryQuery = summaryQuery.gte("day", from);
  if (to) summaryQuery = summaryQuery.lte("day", to);
  const { data: trendRows, error: trendError } = await summaryQuery;
  if (trendError) return NextResponse.json({ error: trendError.message }, { status: 500 });

  return NextResponse.json({ rows: rows ?? [], trend: trendRows ?? [] });
});

export const PATCH = withRateLimit(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as
    | {
        exception_id?: string;
        exception_ids?: string[];
        status?: "acknowledged" | "resolved";
        actor?: string;
        note?: string;
        assignee?: string | null;
        category?: string | null;
        due_at?: string | null;
        resolution?: string | null;
        notes?: string | null;
      }
    | null;

  const ids = body?.exception_ids?.length
    ? body.exception_ids
    : body?.exception_id
      ? [body.exception_id]
      : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "exception_id or exception_ids is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const updates: Record<string, string | null> = {};
  if (body?.status) {
    updates.status = body.status;
    if (body.status === "resolved") updates.resolved_at = now;
  }

  if (body?.assignee !== undefined) updates.assignee = body.assignee;
  if (body?.category !== undefined) updates.category = body.category;
  if (body?.due_at !== undefined) updates.due_at = body.due_at;
  if (body?.resolution !== undefined) updates.resolution = body.resolution;
  if (body?.notes !== undefined) updates.notes = body.notes;

  const { error } = await supabase
    .from("delivery_exceptions")
    .update(updates)
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body?.status) {
    const actions = ids.map((id) => ({
      exception_id: id,
      action: body.status,
      actor: body.actor ?? "admin",
      note: body.note ?? null,
    }));

    const { error: actionError } = await supabase.from("exception_actions").insert(actions);
    if (actionError) return NextResponse.json({ error: actionError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated_count: ids.length });
});
