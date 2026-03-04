import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ShiftInput = {
  day_of_week: number;
  shift_start: string;
  shift_end: string;
  is_active: boolean;
};

type ShiftsBody = {
  shifts?: ShiftInput[];
};

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTime(value: string): boolean {
  return TIME_REGEX.test(value);
}

function validateShift(shift: ShiftInput): string | null {
  if (!Number.isInteger(shift.day_of_week) || shift.day_of_week < 0 || shift.day_of_week > 6) {
    return "day_of_week must be between 0 and 6.";
  }

  if (!isValidTime(shift.shift_start) || !isValidTime(shift.shift_end)) {
    return "shift_start and shift_end must be in HH:mm format.";
  }

  if (shift.shift_end <= shift.shift_start) {
    return "shift_end must be after shift_start.";
  }

  return null;
}
export const GET = withRateLimit(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ warehouse: string }> },
  ) => {
    const { warehouse: rawWarehouse } = await params;
    const warehouseCode = rawWarehouse?.trim().toUpperCase();

    if (!warehouseCode) {
      return NextResponse.json({ error: "warehouse code is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    const { data: warehouse, error: warehouseError } = await supabase
      .from("warehouses")
      .select("id, code")
      .eq("code", warehouseCode)
      .maybeSingle();

    if (warehouseError) {
      return NextResponse.json({ error: warehouseError.message }, { status: 500 });
    }

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("warehouse_shift_configs")
      .select("day_of_week, shift_start, shift_end, is_active")
      .eq("warehouse_id", warehouse.id)
      .order("day_of_week", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      warehouse_id: warehouse.id,
      warehouse_code: warehouse.code,
      shifts: data ?? [],
    });
  },
);
export const PUT = withRateLimit(
  async (request: NextRequest, { params }: { params: Promise<{ warehouse: string }> }) => {
    const { warehouse: rawWarehouse } = await params;
    const warehouseCode = rawWarehouse?.trim().toUpperCase();
    const body = (await request.json().catch(() => null)) as ShiftsBody | null;
    const shifts = body?.shifts ?? [];

    if (!warehouseCode) {
      return NextResponse.json({ error: "warehouse code is required." }, { status: 400 });
    }

    if (!Array.isArray(shifts) || shifts.length !== 7) {
      return NextResponse.json(
        { error: "shifts must be an array with 7 items." },
        { status: 400 },
      );
    }

    for (const shift of shifts) {
      const message = validateShift(shift);
      if (message) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdminClient();
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

    const payload = shifts.map((shift) => ({
      warehouse_id: warehouse.id,
      day_of_week: shift.day_of_week,
      shift_start: shift.shift_start,
      shift_end: shift.shift_end,
      is_active: shift.is_active,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("warehouse_shift_configs")
      .upsert(payload, { onConflict: "warehouse_id,day_of_week" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, warehouse_code: warehouseCode });
  },
);