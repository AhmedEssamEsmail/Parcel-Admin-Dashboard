import Papa from "papaparse";
import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type ImportRow = {
  warehouse_code?: string;
  city?: string;
  sla_minutes?: string;
};

type ParsedCsv = {
  data: ImportRow[];
  errors: string[];
};

type ValidatedRow = {
  warehouse_id: string;
  city: string;
  city_normalized: string;
  sla_minutes: number;
};

function parseCsvText(csvText: string): ParsedCsv {
  const result = Papa.parse<ImportRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  return {
    data: result.data ?? [],
    errors: (result.errors ?? []).map((err) => err.message),
  };
}

function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

export const POST = withRateLimit(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const csv = typeof body?.csv === "string" ? body.csv : "";

  if (!csv.trim()) {
    return NextResponse.json({ error: "csv payload is required." }, { status: 400 });
  }

  const parsed = parseCsvText(csv);
  if (parsed.errors.length > 0) {
    return NextResponse.json(
      {
        error: "CSV parsing failed.",
        errors: parsed.errors,
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: warehouses, error: warehousesError } = await supabase
    .from("warehouses")
    .select("id, code");

  if (warehousesError) {
    return NextResponse.json({ error: warehousesError.message }, { status: 500 });
  }

  const warehouseByCode = new Map((warehouses ?? []).map((w) => [w.code, w.id]));

  const validationErrors: Array<{ row: number; error: string }> = [];
  const validRows: ValidatedRow[] = [];

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const warehouseCode = row.warehouse_code?.trim().toUpperCase() ?? "";
    const city = row.city?.trim() ?? "";
    const slaRaw = row.sla_minutes?.trim() ?? "";

    if (!warehouseCode) {
      validationErrors.push({ row: rowNumber, error: "warehouse_code is required." });
      return;
    }

    const warehouseId = warehouseByCode.get(warehouseCode);
    if (!warehouseId) {
      validationErrors.push({ row: rowNumber, error: `warehouse_code '${warehouseCode}' not found.` });
      return;
    }

    if (!city) {
      validationErrors.push({ row: rowNumber, error: "city is required." });
      return;
    }

    const slaMinutes = Number(slaRaw);
    if (!Number.isInteger(slaMinutes) || slaMinutes < 1 || slaMinutes > 1440) {
      validationErrors.push({ row: rowNumber, error: "sla_minutes must be an integer between 1 and 1440." });
      return;
    }

    validRows.push({
      warehouse_id: warehouseId,
      city,
      city_normalized: normalizeCity(city),
      sla_minutes: slaMinutes,
    });
  });

  if (validRows.length === 0) {
    return NextResponse.json(
      {
        success: false,
        summary: {
          total: parsed.data.length,
          valid: 0,
          invalid: validationErrors.length,
          upserted: 0,
        },
        errors: validationErrors,
      },
      { status: 400 },
    );
  }

  const { data: upsertedRows, error: upsertError } = await supabase
    .from("warehouse_city_sla_configs")
    .upsert(validRows, { onConflict: "warehouse_id,city_normalized" })
    .select("warehouse_id, city_normalized");

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message, errors: validationErrors }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    summary: {
      total: parsed.data.length,
      valid: validRows.length,
      invalid: validationErrors.length,
      upserted: upsertedRows?.length ?? 0,
    },
    errors: validationErrors,
  });
});
