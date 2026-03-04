import {
  parseNullableNumber,
  parseNullableString,
  parseWarehouseDateToIso,
} from "@/lib/ingest/dates";
import { getField } from "@/lib/ingest/normalizers/helpers";
import type { CsvRow, IngestError, NormalizedOptionalRow } from "@/lib/ingest/types";

export function normalizeFreshdeskRows(rows: CsvRow[]): {
  validRows: NormalizedOptionalRow[];
  errors: IngestError[];
} {
  const validRows: NormalizedOptionalRow[] = [];
  const errors: IngestError[] = [];

  rows.forEach((row) => {
    const ticketId = parseNullableNumber(getField(row, ["ticket id", "ticket_id"]));

    if (!ticketId) {
      return;
    }

    validRows.push({
      ticket_id: ticketId,
      created_ts: parseWarehouseDateToIso(
        getField(row, ["order date", "created_ts"]),
        "warehouse_local_gmt_plus_3",
      ),
      status: parseNullableString(getField(row, ["status", "Status"])),
      agent_name: parseNullableString(getField(row, ["agent name", "agent_name"])),
      group_name: parseNullableString(getField(row, ["group name", "group_name"])),
      order_id: parseNullableNumber(getField(row, ["order id", "order_id"])),
      parcel_id: parseNullableNumber(getField(row, ["parcel id", "parcel_id"])),
      contact_type_1: parseNullableString(getField(row, ["contact type", "contact_type_1"])),
      contact_type_2: parseNullableString(
        getField(row, ["contact type 2", "contact_type_2"]),
      ),
      contact_type_3: parseNullableString(
        getField(row, ["contact type 3", "contact_type_3"]),
      ),
    });
  });

  return { validRows, errors };
}
