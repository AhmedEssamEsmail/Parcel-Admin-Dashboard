import {
  parseNullableNumber,
  parseNullableString,
  parseWarehouseDateToIso,
} from "@/lib/ingest/dates";
import { getField } from "@/lib/ingest/normalizers/helpers";
import type { CsvRow, IngestError, NormalizedOptionalRow } from "@/lib/ingest/types";

export function normalizeCollectorsReportRows(rows: CsvRow[]): {
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
      collector: parseNullableString(getField(row, ["collector", "Collector"])),
      start_ts: parseWarehouseDateToIso(
        getField(row, ["start time", "start_ts"]),
      ),
      finish_ts: parseWarehouseDateToIso(
        getField(row, ["finish time", "finish_ts"]),
      ),
      duration_minutes: parseNullableNumber(
        getField(row, ["duration(min)", "duration_minutes", "duration"]),
      ),
    });
  });

  return { validRows, errors };
}
