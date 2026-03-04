import {
  parseNullableNumber,
  parseNullableString,
  parseWarehouseDateToIso,
} from "@/lib/ingest/dates";
import { getField } from "@/lib/ingest/normalizers/helpers";
import type { CsvRow, IngestError, NormalizedParcelLogRow } from "@/lib/ingest/types";

export function normalizeParcelLogRows(rows: CsvRow[]): {
  validRows: NormalizedParcelLogRow[];
  errors: IngestError[];
} {
  const validRows: NormalizedParcelLogRow[] = [];
  const errors: IngestError[] = [];

  rows.forEach((row, index) => {
    const parcelId = parseNullableNumber(getField(row, ["parcel id", "parcel_id"]));
    const statusTs = parseWarehouseDateToIso(
      getField(row, ["parcel date", "status_ts", "status date"]),
    );
    const parcelStatus = parseNullableString(
      getField(row, ["parcelstatus_name", "parcel_status", "status"]),
    );

    if (!parcelId) {
      errors.push({ row: index + 2, message: "Missing Parcel ID" });
      return;
    }

    if (!statusTs) {
      errors.push({ row: index + 2, message: "Missing/invalid Parcel Date" });
      return;
    }

    if (!parcelStatus) {
      errors.push({ row: index + 2, message: "Missing parcel status" });
      return;
    }

    validRows.push({
      parcel_id: parcelId,
      order_id: parseNullableNumber(getField(row, ["order id", "order_id"])),
      parcel_status: parcelStatus,
      status_ts: statusTs,
    });
  });

  return { validRows, errors };
}
