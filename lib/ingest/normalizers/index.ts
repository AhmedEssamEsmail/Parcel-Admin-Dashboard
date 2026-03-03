import { normalizeDeliveryDetailsRows } from "@/lib/ingest/normalizers/deliveryDetails";
import { normalizeParcelLogRows } from "@/lib/ingest/normalizers/parcelLogs";
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
