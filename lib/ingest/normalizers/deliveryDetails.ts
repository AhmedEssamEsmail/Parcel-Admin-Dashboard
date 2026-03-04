import {
  parseNullableNumber,
  parseNullableString,
  parseWarehouseDateToIso,
} from "@/lib/ingest/dates";
import { getField } from "@/lib/ingest/normalizers/helpers";
import type {
  CsvRow,
  IngestError,
  NormalizedDeliveryDetailsRow,
} from "@/lib/ingest/types";

export function normalizeDeliveryDetailsRows(rows: CsvRow[]): {
  validRows: NormalizedDeliveryDetailsRow[];
  errors: IngestError[];
} {
  const validRows: NormalizedDeliveryDetailsRow[] = [];
  const errors: IngestError[] = [];

  rows.forEach((row, index) => {
    const parcelId = parseNullableNumber(getField(row, ["parcel_id", "Parcel ID"]));
    const orderDate = parseWarehouseDateToIso(
      getField(row, ["order_date", "Order Date"]),
      "utc_source",
    );

    if (!parcelId) {
      errors.push({ row: index + 2, message: "Missing parcel_id" });
      return;
    }

    if (!orderDate) {
      errors.push({ row: index + 2, message: "Missing/invalid order_date" });
      return;
    }

    validRows.push({
      parcel_id: parcelId,
      order_id: parseNullableNumber(getField(row, ["order_id", "Order ID"])),
      order_date: orderDate,
      delivery_date: parseWarehouseDateToIso(
        getField(row, ["delivery_date", "parcel_delivery_date", "Delivery Date"]),
        "utc_source",
      ),
      order_status:
        parseNullableString(getField(row, ["order_status", "Order Status"])) ?? "Unknown",
      delivery_address: parseNullableString(
        getField(row, ["delivery_address", "Delivery Address"]),
      ),
      city:
        parseNullableString(getField(row, ["city", "City"])) ??
        parseNullableString(getField(row, ["country_name", "Country"])),
      area: parseNullableString(getField(row, ["area", "area_name", "Area"])),
      zone: parseNullableString(getField(row, ["zone", "Zone"])),
    });
  });

  return { validRows, errors };
}
