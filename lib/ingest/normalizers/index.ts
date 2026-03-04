import { normalizeCollectorsReportRows } from "@/lib/ingest/normalizers/collectorsReport";
import { normalizeDeliveryTimingRulesRows } from "@/lib/ingest/normalizers/deliveryTimingRules";
import { normalizeDeliveryDetailsRows } from "@/lib/ingest/normalizers/deliveryDetails";
import { normalizeFreshdeskRows } from "@/lib/ingest/normalizers/freshdeskTickets";
import { normalizeItemsPerOrderRows } from "@/lib/ingest/normalizers/itemsPerOrder";
import { normalizeParcelLogRows } from "@/lib/ingest/normalizers/parcelLogs";
import { normalizePrepareReportRows } from "@/lib/ingest/normalizers/prepareReport";
import { normalizeWaOrdersRows } from "@/lib/ingest/normalizers/waOrders";
import type {
  CsvRow,
  DatasetType,
  IngestError,
  IngestWarning,
  SupportedNormalizedRow,
} from "@/lib/ingest/types";

export function normalizeDatasetRows(datasetType: DatasetType, rows: CsvRow[]): {
  validRows: SupportedNormalizedRow[];
  errors: IngestError[];
  warnings: IngestWarning[];
} {
  switch (datasetType) {
    case "delivery_details": {
      const result = normalizeDeliveryDetailsRows(rows);
      return { ...result, warnings: [] };
    }
    case "parcel_logs":
      return normalizeParcelLogRows(rows);
    case "items_per_order": {
      const result = normalizeItemsPerOrderRows(rows);
      return { ...result, warnings: [] };
    }
    case "collectors_report": {
      const result = normalizeCollectorsReportRows(rows);
      return { ...result, warnings: [] };
    }
    case "prepare_report": {
      const result = normalizePrepareReportRows(rows);
      return { ...result, warnings: [] };
    }
    case "freshdesk_tickets": {
      const result = normalizeFreshdeskRows(rows);
      return { ...result, warnings: [] };
    }
    case "wa_orders": {
      const result = normalizeWaOrdersRows(rows);
      return { ...result, warnings: [] };
    }
    case "delivery_timing_rules": {
      const result = normalizeDeliveryTimingRulesRows(rows);
      return { ...result, warnings: [] };
    }
    default:
      return {
        validRows: [],
        warnings: [],
        errors: [
          {
            row: 0,
            message: `${datasetType} normalizer is not implemented yet in this build.`,
          },
        ],
      };
  }
}
