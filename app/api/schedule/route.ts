import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ScheduleOverrideInput = {
  shiftDate: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
};

type ScheduleBody = {
  warehouseCode?: string;
  overrides?: ScheduleOverrideInput[];
  shiftDate?: string;
  shiftStart?: string | null;
  shiftEnd?: string | null;
};

function normalizeTime(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const raw = value.trim();
  if (!raw) return null;

  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throw new Error(`Invalid time format: ${raw}. Expected HH:mm.`);
  }

  return raw;
}

function normalizeDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date format: ${value}. Expected YYYY-MM-DD.`);
  }

  return value;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as ScheduleBody | null;
  const warehouseCode = body?.warehouseCode?.trim().toUpperCase();

  if (!warehouseCode) {
    return NextResponse.json({ error: "warehouseCode is required." }, { status: 400 });
  }

  const overridesInput: ScheduleOverrideInput[] =
    body?.overrides && body.overrides.length > 0
      ? body.overrides
      : body?.shiftDate
        ? [
            {
              shiftDate: body.shiftDate,
              shiftStart: body.shiftStart,
              shiftEnd: body.shiftEnd,
            },
          ]
        : [];

  if (overridesInput.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one override in overrides[] or shiftDate." },
      { status: 400 },
    );
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
    return NextResponse.json(
      { error: `Unknown warehouse code: ${warehouseCode}` },
      { status: 400 },
    );
  }

  let payload: Array<{
    warehouse_id: string;
    shift_date: string;
    shift_start: string | null;
    shift_end: string | null;
  }>;

  try {
    payload = overridesInput.map((entry) => ({
      warehouse_id: warehouse.id,
      shift_date: normalizeDate(entry.shiftDate),
      shift_start: normalizeTime(entry.shiftStart),
      shift_end: normalizeTime(entry.shiftEnd),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid override payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("warehouse_shift_overrides")
    .upsert(payload, {
      onConflict: "warehouse_id,shift_date",
      count: "exact",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    warehouseCode,
    upsertedCount: count ?? payload.length,
  });
}
