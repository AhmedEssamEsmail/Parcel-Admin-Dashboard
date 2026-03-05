import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const parcelId = params.get("parcel_id")?.trim();

  if (!warehouse || !parcelId) {
    return NextResponse.json({ error: "warehouse and parcel_id are required." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("v_raw_delivery_stages")
    .select("*")
    .eq("warehouse", warehouse)
    .eq("parcel_id", parcelId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ parcel: data ?? null });
});
