import {
  parseNullableNumber,
  parseNullableString,
  parseWarehouseDateToIso,
} from "@/lib/ingest/dates";
import { getField } from "@/lib/ingest/normalizers/helpers";
import type { CsvRow, IngestError, NormalizedOptionalRow } from "@/lib/ingest/types";

export function normalizePrepareReportRows(rows: CsvRow[]): {
  validRows: NormalizedOptionalRow[];
  errors: IngestError[];
} {
  const validRows: NormalizedOptionalRow[] = [];
  const errors: IngestError[] = [];

  rows.forEach((row) => {
    const parcelId = parseNullableNumber(getField(row, ["parcel id", "parcel_id"]));

    if (!parcelId) {
      return;
    }

    validRows.push({
      parcel_id: parcelId,
      wrapper: parseNullableString(getField(row, ["preparer", "wrapper"])),
      start_ts: parseWarehouseDateToIso(
        getField(row, ["start time", "start_ts"]),
        "warehouse_local_gmt_plus_3",
      ),
      finish_ts: parseWarehouseDateToIso(
        getField(row, ["finish time", "finish_ts"]),
        "warehouse_local_gmt_plus_3",
      ),
      duration_minutes: parseNullableNumber(
        getField(row, ["duration(min)", "duration_minutes", "duration"]),
      ),
    });
  });

  return { validRows, errors };
}
