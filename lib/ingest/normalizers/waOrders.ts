import {
  parseNullableNumber,
  parseNullableString,
  parseWarehouseDateToIso,
} from "@/lib/ingest/dates";
import { getField } from "@/lib/ingest/normalizers/helpers";
import type { CsvRow, IngestError, NormalizedWaOrderRow } from "@/lib/ingest/types";

export function normalizeWaOrdersRows(rows: CsvRow[]): {
  validRows: NormalizedWaOrderRow[];
  errors: IngestError[];
} {
  const validRows: NormalizedWaOrderRow[] = [];
  const errors: IngestError[] = [];

  rows.forEach((row, index) => {
    const parcelId = parseNullableNumber(
      getField(row, ["parcel_id", "parcel id", "Parcel_id", "Parcel ID"]),
    );

    if (!parcelId) {
      errors.push({ row: index + 2, message: "Missing parcel_id" });
      return;
    }

    validRows.push({
      parcel_id: parcelId,
      invoice_cdate: parseWarehouseDateToIso(
        getField(row, ["invoice_cdate", "invoice cdate", "invoice_CDate", "Invoice_CDate"]),
      ),
      address_text: parseNullableString(
        getField(row, ["text_en", "address", "delivery_address", "Text_EN"]),
      ),
      country_name: parseNullableString(getField(row, ["country_name", "Country_Name"])),
    });
  });

  return { validRows, errors };
}
