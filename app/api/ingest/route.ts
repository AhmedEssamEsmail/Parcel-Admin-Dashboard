import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { DATASET_TYPES, type DatasetType } from "@/lib/ingest/types";

type IngestBody = {
  warehouseCode?: string;
  datasetType?: DatasetType;
  rows?: Array<Record<string, string | number | null>>;
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
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as IngestBody | null;
  const warehouseCode = body?.warehouseCode?.trim().toUpperCase();
  const datasetType = body?.datasetType;
  const rows = body?.rows ?? [];

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

  return NextResponse.json({
    warehouseCode,
    datasetType,
    parsedCount: payload.length,
    insertedCount,
    ignoredCount,
  });
}
