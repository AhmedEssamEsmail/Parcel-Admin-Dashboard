import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { DATASET_TYPES, type DatasetType } from "@/lib/ingest/types";

type IngestBody = {
  warehouseCode?: string;
  datasetType?: DatasetType;
  rows?: Array<Record<string, string | number | null>>;
  fileName?: string;
  parsedCount?: number;
  warningCount?: number;
  errorCount?: number;
};

const DATASET_CONFIG: Record<
  DatasetType,
  { table: string; onConflict: string }
> = {
  delivery_details: {
    table: "delivery_details",
    onConflict: "warehouse_id,parcel_id",
  },
  parcel_logs: {
    table: "parcel_logs",
    onConflict: "warehouse_id,parcel_id,parcel_status,status_ts",
  },
  items_per_order: {
    table: "items_per_order",
    onConflict: "warehouse_id,parcel_id",
  },
  collectors_report: {
    table: "collectors_report",
    onConflict: "warehouse_id,parcel_id",
  },
  prepare_report: {
    table: "prepare_report",
    onConflict: "warehouse_id,parcel_id",
  },
  freshdesk_tickets: {
    table: "freshdesk_tickets",
    onConflict: "warehouse_id,ticket_id",
  },
  wa_orders: {
    table: "wa_orders",
    onConflict: "warehouse_id,parcel_id",
  },
  delivery_timing_rules: {
    table: "warehouse_delivery_timing_rules",
    onConflict: "warehouse_id,city_normalized",
  },
};

export const POST = withRateLimit(async (request: NextRequest) => {
  const startedAtIso = new Date().toISOString();
  const body = (await request.json().catch(() => null)) as IngestBody | null;
  const warehouseCode = body?.warehouseCode?.trim().toUpperCase();
  const datasetType = body?.datasetType;
  const rows = body?.rows ?? [];
  const fileName = body?.fileName?.trim() || null;
  const parsedCount = Math.max(0, Number(body?.parsedCount ?? rows.length) || rows.length);
  const warningCount = Math.max(0, Number(body?.warningCount ?? 0) || 0);
  const errorCount = Math.max(0, Number(body?.errorCount ?? 0) || 0);

  if (!warehouseCode) {
    return NextResponse.json({ error: "warehouseCode is required." }, { status: 400 });
  }

  if (!datasetType || !DATASET_TYPES.includes(datasetType)) {
    return NextResponse.json({ error: "datasetType is invalid." }, { status: 400 });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "rows must be a non-empty array." }, { status: 400 });
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
    return NextResponse.json(
      { error: `Unknown warehouse code: ${warehouseCode}` },
      { status: 400 },
    );
  }

  const config = DATASET_CONFIG[datasetType];
  const payload = rows.map((row) => ({ ...row, warehouse_id: warehouse.id }));

  const { error, count } = await supabase
    .from(config.table)
    .upsert(payload, {
      onConflict: config.onConflict,
      ignoreDuplicates: true,
      count: "exact",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const insertedCount = count ?? 0;
  const ignoredCount = Math.max(0, payload.length - insertedCount);
  const status = errorCount > 0 ? (insertedCount > 0 ? "partial" : "failed") : "success";

  const { data: ingestRun, error: ingestRunError } = await supabase
    .from("ingest_runs")
    .insert({
      warehouse_code: warehouseCode,
      dataset_type: datasetType,
      file_name: fileName,
      parsed_count: parsedCount,
      valid_count: rows.length,
      inserted_count: insertedCount,
      ignored_count: ignoredCount,
      warning_count: warningCount,
      error_count: errorCount,
      status,
      details: {
        api: "/api/ingest",
      },
      started_at: startedAtIso,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (ingestRunError) {
    // Keep ingestion successful even if observability tables are not migrated yet.
    console.warn("Failed to write ingest_runs:", ingestRunError.message);
  }

  return NextResponse.json({
    warehouseCode,
    datasetType,
    parsedCount,
    validCount: rows.length,
    warningCount,
    errorCount,
    insertedCount,
    ignoredCount,
    ingestRunId: ingestRun?.id ?? null,
  });
});
