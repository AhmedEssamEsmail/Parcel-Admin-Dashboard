import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { RawDeliveryScope } from "@/lib/table/rawDeliveryStages";

const ALLOWED_SCOPES: RawDeliveryScope[] = ["delivered", "all", "not_delivered"];

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

  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(params.get("limit") ?? "50", 10) || 50),
  );
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

  let query = supabase
    .from("v_raw_delivery_stages_with_source")
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

  if (parcelId) {
    query = query.eq("parcel_id", parcelId);
  }

  if (wa === "yes") {
    query = query.eq("waiting_address", "Yes");
  } else if (wa === "no") {
    query = query.eq("waiting_address", "No");
  }

  if (cutoff) {
    query = query.eq("cutoff_status", cutoff);
  }

  if (kpi) {
    query = query.eq("delivery_kpi", kpi);
  }

  if (ticket === "yes") {
    query = query.eq("has_a_ticket", "Yes");
  } else if (ticket === "no") {
    query = query.eq("has_a_ticket", "No");
  }

  if (zone) {
    query = query.ilike("zone", `%${zone}%`);
  }

  if (city) {
    query = query.ilike("city", `%${city}%`);
  }

  if (area) {
    query = query.ilike("area", `%${area}%`);
  }

  if (opsIssue) {
    query = query.eq("ops_exceeded_30_mins", opsIssue);
  }

  if (timingSource) {
    query = query.eq("timing_source", timingSource);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: data ?? [],
    totalCount: count ?? 0,
    limit,
    offset,
  });
});
