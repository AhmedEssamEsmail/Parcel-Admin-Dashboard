import { NextRequest, NextResponse } from "next/server";

import { AUTH_SCOPE_COOKIE_NAME, AUTH_SCOPE_FULL_ACCESS } from "@/lib/auth/constants";
import { decodeScopeCookie, isWarehouseAllowed } from "@/lib/auth/scopes";
import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type UpdateSlaBody = {
  warehouse_id?: string;
  sla_minutes?: number;
};

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export const GET = withRateLimit(async (request: NextRequest) => {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("warehouses")
    .select("id, code, name, sla_minutes, default_shift_start, default_shift_end, tz")
    .order("code", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allowedWarehouses = decodeScopeCookie(request.cookies.get(AUTH_SCOPE_COOKIE_NAME)?.value);

  const scopedWarehouses =
    allowedWarehouses === AUTH_SCOPE_FULL_ACCESS
      ? data ?? []
      : (data ?? []).filter((warehouse) => isWarehouseAllowed(warehouse.code, allowedWarehouses));

  return NextResponse.json({ warehouses: scopedWarehouses });
});

export const PUT = withRateLimit(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as UpdateSlaBody | null;
  const warehouseId = body?.warehouse_id?.trim();
  const slaMinutes = body?.sla_minutes;

  if (!warehouseId || !isValidUuid(warehouseId)) {
    return NextResponse.json({ error: "warehouse_id must be a valid UUID." }, { status: 400 });
  }

  if (typeof slaMinutes !== "number") {
    return NextResponse.json(
      { error: "sla_minutes is required." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(slaMinutes) || slaMinutes < 1 || slaMinutes > 1440) {
    return NextResponse.json(
      { error: "sla_minutes must be an integer between 1 and 1440." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("warehouses")
    .update({ sla_minutes: slaMinutes })
    .eq("id", warehouseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, warehouse_id: warehouseId, sla_minutes: slaMinutes });
});
