import {
  parseNullableNumber,
  parseWarehouseDateToIso,
} from "@/lib/ingest/dates";
import { getField } from "@/lib/ingest/normalizers/helpers";
import type { CsvRow, IngestError, NormalizedOptionalRow } from "@/lib/ingest/types";

export function normalizeItemsPerOrderRows(rows: CsvRow[]): {
  validRows: NormalizedOptionalRow[];
  errors: IngestError[];
} {
  const validRows: NormalizedOptionalRow[] = [];
  const errors: IngestError[] = [];

  rows.forEach((row) => {
    const parcelId = parseNullableNumber(
      getField(row, ["invoiceparcel_id", "invoiceParcel_id", "parcel_id", "Parcel ID"]),
    );

    if (!parcelId) {
      return;
    }

    const itemCountRaw = parseNullableNumber(
      getField(row, ["invoiceparcel_id count", "invoiceParcel_id Count", "item_count"]),
    );

    validRows.push({
      invoice_id: parseNullableNumber(getField(row, ["invoice_id", "Invoice ID"])),
      parcel_id: parcelId,
      item_count: itemCountRaw === null ? null : Math.trunc(itemCountRaw),
      created_ts: parseWarehouseDateToIso(
        getField(row, ["datetime of cdate_kuwait", "Datetime of CDate_Kuwait", "created_ts"]),
      ),
    });
  });

  return { validRows, errors };
}
