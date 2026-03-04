import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type OverrideUpdateBody = {
  shift_start?: string | null;
  shift_end?: string | null;
  reason?: string;
};

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

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export const PUT = withRateLimit(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: rawId } = await params;
  const id = rawId?.trim();
  if (!id || !isValidUuid(id)) {
    return NextResponse.json({ error: "Invalid override id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as OverrideUpdateBody | null;

  try {
    const shiftStart = normalizeTime(body?.shift_start);
    const shiftEnd = normalizeTime(body?.shift_end);
    const reason = body?.reason?.trim();

    if (!reason) {
      throw new Error("reason is required.");
    }

    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from("warehouse_shift_overrides")
      .update({ shift_start: shiftStart, shift_end: shiftEnd, reason })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid override payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

export const DELETE = withRateLimit(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: rawId } = await params;
  const id = rawId?.trim();
  if (!id || !isValidUuid(id)) {
    return NextResponse.json({ error: "Invalid override id." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("warehouse_shift_overrides").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id });
});