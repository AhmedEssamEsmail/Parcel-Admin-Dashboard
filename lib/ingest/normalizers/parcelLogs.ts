import {
  parseNullableNumber,
  parseNullableString,
  parseWarehouseDateToIso,
} from "@/lib/ingest/dates";
import { getField } from "@/lib/ingest/normalizers/helpers";
import type {
  CsvRow,
  IngestError,
  IngestWarning,
  NormalizedParcelLogRow,
} from "@/lib/ingest/types";

export function normalizeParcelLogRows(rows: CsvRow[]): {
  validRows: NormalizedParcelLogRow[];
  errors: IngestError[];
  warnings: IngestWarning[];
} {
  const validRows: NormalizedParcelLogRow[] = [];
  const errors: IngestError[] = [];
  const warnings: IngestWarning[] = [];
  let lastValidStatusTs: string | null = null;

  rows.forEach((row, index) => {
    const parcelId = parseNullableNumber(getField(row, ["parcel id", "parcel_id"]));
    const statusTsRaw = getField(row, ["parcel date", "status_ts", "status date"]);
    const statusTsParsed = parseWarehouseDateToIso(statusTsRaw);
    const statusTsWasBlank = statusTsRaw.trim() === "";
    const statusTs = statusTsParsed ?? (statusTsWasBlank ? lastValidStatusTs : null);
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

    if (!statusTsParsed && statusTsWasBlank && lastValidStatusTs) {
      warnings.push({
        row: index + 2,
        message: "Blank Parcel Date filled using previous row timestamp.",
      });
    }

    if (!parcelStatus) {
      errors.push({ row: index + 2, message: "Missing parcel status" });
      return;
    }

    lastValidStatusTs = statusTs;

    validRows.push({
      parcel_id: parcelId,
      order_id: parseNullableNumber(getField(row, ["order id", "order_id"])),
      parcel_status: parcelStatus,
      status_ts: statusTs,
    });
  });

  return { validRows, errors, warnings };
}
