import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  const supabase = getSupabaseAdminClient();
  let query = supabase.from("v_promise_reliability_daily").select("*").order("day", { ascending: true });
  if (warehouse && warehouse !== "ALL") query = query.eq("warehouse_code", warehouse);
  if (from) query = query.gte("day", from);
  if (to) query = query.lte("day", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rows: data ?? [] });
});
