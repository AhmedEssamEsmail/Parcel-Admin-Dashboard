import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type OverrideInput = {
  warehouse_code?: string;
  override_date?: string;
  shift_start?: string | null;
  shift_end?: string | null;
  reason?: string;
  start_date?: string;
  end_date?: string;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeTime(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!TIME_REGEX.test(trimmed)) {
    throw new Error(`Invalid time format: ${trimmed}. Expected HH:mm.`);
  }
  return trimmed;
}

function normalizeDate(value: string | undefined, label: string): string {
  if (!value || !DATE_REGEX.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD.`);
  }
  return value;
}

function buildDateRange(start: string, end: string): string[] {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid date range.");
  }
  if (endDate < startDate) {
    throw new Error("end_date must be on or after start_date.");
  }
  const dates: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouseCode = params.get("warehouse_code")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("warehouse_shift_overrides")
    .select("id, warehouse_id, shift_date, shift_start, shift_end, reason")
    .order("shift_date", { ascending: true });

  if (from) {
    query = query.gte("shift_date", from);
  }

  if (to) {
    query = query.lte("shift_date", to);
  }

  if (warehouseCode && warehouseCode !== "ALL") {
    const { data: warehouse, error: warehouseError } = await supabase
      .from("warehouses")
      .select("id")
      .eq("code", warehouseCode)
      .maybeSingle();

    if (warehouseError) {
      return NextResponse.json({ error: warehouseError.message }, { status: 500 });
    }

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found." }, { status: 404 });
    }

    query = query.eq("warehouse_id", warehouse.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const overrides = (data ?? []).map((row) => ({
    id: row.id,
    warehouse_id: row.warehouse_id,
    override_date: row.shift_date,
    shift_start: row.shift_start,
    shift_end: row.shift_end,
    reason: row.reason,
  }));

  return NextResponse.json({ overrides });
});

export const POST = withRateLimit(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as OverrideInput | null;
  const warehouseCode = body?.warehouse_code?.trim().toUpperCase();

  if (!warehouseCode) {
    return NextResponse.json({ error: "warehouse_code is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  const targetWarehouses =
    warehouseCode === "ALL"
      ? await supabase.from("warehouses").select("id, code")
      : await supabase.from("warehouses").select("id, code").eq("code", warehouseCode);

  if (targetWarehouses.error) {
    return NextResponse.json({ error: targetWarehouses.error.message }, { status: 500 });
  }

  const warehouses = targetWarehouses.data ?? [];
  if (warehouses.length === 0) {
    return NextResponse.json({ error: "Warehouse not found." }, { status: 404 });
  }

  const isBulk = Boolean(body?.start_date && body?.end_date);

  try {
    if (isBulk) {
      const startDate = normalizeDate(body?.start_date, "start_date");
      const endDate = normalizeDate(body?.end_date, "end_date");
      const shiftStart = normalizeTime(body?.shift_start);
      const shiftEnd = normalizeTime(body?.shift_end);
      const reason = body?.reason?.trim() ?? "";

      if (!shiftStart || !shiftEnd) {
        throw new Error("shift_start and shift_end are required for bulk overrides.");
      }

      if (!reason) {
        throw new Error("reason is required.");
      }

      const dateSeries = buildDateRange(startDate, endDate);

      const payload = dateSeries.flatMap((entry) =>
        warehouses.map((warehouse) => ({
          warehouse_id: warehouse.id,
          shift_date: entry,
          shift_start: shiftStart,
          shift_end: shiftEnd,
          reason,
        })),
      );

      const { error } = await supabase
        .from("warehouse_shift_overrides")
        .upsert(payload, { onConflict: "warehouse_id,shift_date" });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, created: payload.length });
    }

    const overrideDate = normalizeDate(body?.override_date, "override_date");
    const shiftStart = normalizeTime(body?.shift_start);
    const shiftEnd = normalizeTime(body?.shift_end);
    const reason = body?.reason?.trim() ?? "";

    if (!reason) {
      throw new Error("reason is required.");
    }

    const payload = warehouses.map((warehouse) => ({
      warehouse_id: warehouse.id,
      shift_date: overrideDate,
      shift_start: shiftStart,
      shift_end: shiftEnd,
      reason,
    }));

    const { error } = await supabase
      .from("warehouse_shift_overrides")
      .upsert(payload, { onConflict: "warehouse_id,shift_date" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, created: payload.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid override payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});