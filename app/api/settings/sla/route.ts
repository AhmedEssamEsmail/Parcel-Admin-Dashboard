import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type SlaConfigInput = {
  warehouse_code?: string;
  city?: string;
  sla_minutes?: number;
};

type UpsertBody = {
  configs?: SlaConfigInput[];
};

function normalizeCity(value: string): string {
  return value.trim().toLowerCase();
}

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouseCode = params.get("warehouse_code")?.trim().toUpperCase();
  const cityFilter = params.get("city")?.trim().toLowerCase();

  const supabase = getSupabaseAdminClient();

  const { data: warehouses, error: warehouseError } = await supabase
    .from("warehouses")
    .select("id, code");

  if (warehouseError) {
    return NextResponse.json({ error: warehouseError.message }, { status: 500 });
  }

  const warehouseById = new Map((warehouses ?? []).map((w) => [w.id, w.code]));
  const warehouseByCode = new Map((warehouses ?? []).map((w) => [w.code, w.id]));

  let query = supabase
    .from("warehouse_city_sla_configs")
    .select("warehouse_id, city, city_normalized, sla_minutes, updated_at")
    .order("updated_at", { ascending: false });

  if (warehouseCode) {
    const warehouseId = warehouseByCode.get(warehouseCode);
    if (!warehouseId) {
      return NextResponse.json({ error: "Warehouse not found." }, { status: 404 });
    }
    query = query.eq("warehouse_id", warehouseId);
  }

  if (cityFilter) {
    query = query.eq("city_normalized", normalizeCity(cityFilter));
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const configs = (data ?? []).map((row) => ({
    warehouse_id: row.warehouse_id,
    warehouse_code: warehouseById.get(row.warehouse_id) ?? null,
    city: row.city,
    city_normalized: row.city_normalized,
    sla_minutes: row.sla_minutes,
    updated_at: row.updated_at,
  }));

  return NextResponse.json({ configs });
});

export const POST = withRateLimit(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as UpsertBody | null;
  const configs = body?.configs;

  if (!Array.isArray(configs) || configs.length === 0) {
    return NextResponse.json({ error: "configs must be a non-empty array." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: warehouses, error: warehouseError } = await supabase
    .from("warehouses")
    .select("id, code");

  if (warehouseError) {
    return NextResponse.json({ error: warehouseError.message }, { status: 500 });
  }

  const warehouseByCode = new Map((warehouses ?? []).map((w) => [w.code, w.id]));

  const errors: Array<{ index: number; error: string }> = [];
  const payload: Array<{
    warehouse_id: string;
    city: string;
    city_normalized: string;
    sla_minutes: number;
  }> = [];

  configs.forEach((item, index) => {
    const warehouseCode = item.warehouse_code?.trim().toUpperCase();
    const city = item.city?.trim() ?? "";
    const slaMinutes = item.sla_minutes;

    if (!warehouseCode) {
      errors.push({ index, error: "warehouse_code is required." });
      return;
    }

    const warehouseId = warehouseByCode.get(warehouseCode);
    if (!warehouseId) {
      errors.push({ index, error: `warehouse_code '${warehouseCode}' not found.` });
      return;
    }

    if (!city) {
      errors.push({ index, error: "city is required." });
      return;
    }

    if (typeof slaMinutes !== "number" || !Number.isInteger(slaMinutes) || slaMinutes < 1 || slaMinutes > 1440) {
      errors.push({ index, error: "sla_minutes must be an integer between 1 and 1440." });
      return;
    }

    payload.push({
      warehouse_id: warehouseId,
      city,
      city_normalized: normalizeCity(city),
      sla_minutes: slaMinutes,
    });
  });

  if (payload.length === 0) {
    return NextResponse.json({ error: "No valid rows to upsert.", errors }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("warehouse_city_sla_configs")
    .upsert(payload, { onConflict: "warehouse_id,city_normalized" })
    .select("warehouse_id, city, city_normalized, sla_minutes, updated_at");

  if (error) {
    return NextResponse.json({ error: error.message, errors }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    upserted: data?.length ?? 0,
    errors,
  });
});
