import { normalizeCollectorsReportRows } from "@/lib/ingest/normalizers/collectorsReport";
import { normalizeDeliveryDetailsRows } from "@/lib/ingest/normalizers/deliveryDetails";
import { normalizeFreshdeskRows } from "@/lib/ingest/normalizers/freshdeskTickets";
import { normalizeItemsPerOrderRows } from "@/lib/ingest/normalizers/itemsPerOrder";
import { normalizeParcelLogRows } from "@/lib/ingest/normalizers/parcelLogs";
import { normalizePrepareReportRows } from "@/lib/ingest/normalizers/prepareReport";
import type {
  CsvRow,
  DatasetType,
  IngestError,
  SupportedNormalizedRow,
} from "@/lib/ingest/types";

export function normalizeDatasetRows(datasetType: DatasetType, rows: CsvRow[]): {
  validRows: SupportedNormalizedRow[];
  errors: IngestError[];
} {
  switch (datasetType) {
    case "delivery_details":
      return normalizeDeliveryDetailsRows(rows);
    case "parcel_logs":
      return normalizeParcelLogRows(rows);
    case "items_per_order":
      return normalizeItemsPerOrderRows(rows);
    case "collectors_report":
      return normalizeCollectorsReportRows(rows);
    case "prepare_report":
      return normalizePrepareReportRows(rows);
    case "freshdesk_tickets":
      return normalizeFreshdeskRows(rows);
    default:
      return {
        validRows: [],
        errors: [
          {
            row: 0,
            message: `${datasetType} normalizer is not implemented yet in this build.`,
          },
        ],
      };
  }
}
