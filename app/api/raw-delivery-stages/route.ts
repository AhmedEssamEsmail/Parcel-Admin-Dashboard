import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { RawDeliveryScope } from "@/lib/table/rawDeliveryStages";

const ALLOWED_SCOPES: RawDeliveryScope[] = ["delivered", "all", "not_delivered"];

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: { code?: string; message?: string } | null;
  count: number | null;
};

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

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const parcelId = params.get("parcel_id")?.trim();
  const wa = params.get("wa")?.trim().toLowerCase();
  const cutoff = params.get("cutoff")?.trim();
  const kpi = params.get("kpi")?.trim();
  const ticket = params.get("ticket")?.trim().toLowerCase();
  const zone = params.get("zone")?.trim();
  const city = params.get("city")?.trim();
  const area = params.get("area")?.trim();
  const opsIssue = params.get("ops_issue")?.trim();
  const timingSource = params.get("timing_source")?.trim();
  const deliveryScope = (params.get("delivery_scope")?.trim() || "delivered") as RawDeliveryScope;

  const limit = Math.min(200, Math.max(1, Number.parseInt(params.get("limit") ?? "50", 10) || 50));
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);

  if (!warehouse || !from || !to) {
    return NextResponse.json(
      { error: "warehouse, from, and to query params are required." },
      { status: 400 },
    );
  }

  if (!ALLOWED_SCOPES.includes(deliveryScope)) {
    return NextResponse.json(
      { error: `delivery_scope must be one of: ${ALLOWED_SCOPES.join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();

  const runQuery = async (viewName: string, timingSourceSupported: boolean): Promise<QueryResult> => {
    let query = supabase
      .from(viewName)
      .select("*", { count: "exact" })
      .eq("warehouse", warehouse)
      .gte("order_date", from)
      .lte("order_date", to)
      .order("order_date", { ascending: true })
      .order("parcel_id", { ascending: true });

    if (deliveryScope === "delivered") {
      query = query.eq("order_status", "Delivered");
    } else if (deliveryScope === "not_delivered") {
      query = query.eq("order_status", "Not Delivered");
    }

    if (parcelId) query = query.eq("parcel_id", parcelId);
    if (wa === "yes") query = query.eq("waiting_address", "Yes");
    else if (wa === "no") query = query.eq("waiting_address", "No");
    if (cutoff) query = query.eq("cutoff_status", cutoff);
    if (kpi) query = query.eq("delivery_kpi", kpi);
    if (ticket === "yes") query = query.eq("has_a_ticket", "Yes");
    else if (ticket === "no") query = query.eq("has_a_ticket", "No");
    if (zone) query = query.ilike("zone", `%${zone}%`);
    if (city) query = query.ilike("city", `%${city}%`);
    if (area) query = query.ilike("area", `%${area}%`);
    if (opsIssue) query = query.eq("ops_exceeded_30_mins", opsIssue);
    if (timingSourceSupported && timingSource && timingSource.toLowerCase() !== "all") {
      query = query.eq("timing_source", timingSource);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    return { data, error, count };
  };

  const primary = await runQuery("v_raw_delivery_stages_with_source", true);
  if (!primary.error) {
    return NextResponse.json({
      rows: primary.data ?? [],
      totalCount: primary.count ?? 0,
      limit,
      offset,
      timingSourceSupported: true,
    });
  }

  if (!isMissingRelationError(primary.error, "v_raw_delivery_stages_with_source")) {
    return NextResponse.json({ error: primary.error.message ?? "Failed to query raw delivery stages." }, { status: 500 });
  }

  const fallback = await runQuery("v_raw_delivery_stages", false);
  if (fallback.error) {
    return NextResponse.json({ error: fallback.error.message ?? "Failed to query raw delivery stages." }, { status: 500 });
  }

  const warning =
    timingSource && timingSource !== "all"
      ? "Timing Source filter is unavailable in this environment and was ignored."
      : "Timing Source metadata is unavailable in this environment; showing base raw delivery stages view.";

  return NextResponse.json({
    rows: fallback.data ?? [],
    totalCount: fallback.count ?? 0,
    limit,
    offset,
    timingSourceSupported: false,
    warning,
  });
});
