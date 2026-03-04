export const DATASET_TYPES = [
  "delivery_details",
  "parcel_logs",
  "items_per_order",
  "collectors_report",
  "prepare_report",
  "freshdesk_tickets",
  "wa_orders",
  "delivery_timing_rules",
] as const;

export type DatasetType = (typeof DATASET_TYPES)[number];

export type CsvRow = Record<string, string>;

export type IngestError = {
  row: number;
  message: string;
};

export type IngestWarning = {
  row: number;
  message: string;
};

export type NormalizedDeliveryDetailsRow = {
  parcel_id: number;
  order_id: number | null;
  order_date: string;
  delivery_date: string | null;
  order_status: string;
  delivery_address: string | null;
  city: string | null;
  area: string | null;
  zone: string | null;
};

export type NormalizedParcelLogRow = {
  parcel_id: number;
  order_id: number | null;
  parcel_status: string;
  status_ts: string;
};

export type NormalizedWaOrderRow = {
  parcel_id: number;
  invoice_cdate: string | null;
  address_text: string | null;
  country_name: string | null;
};

export type NormalizedDeliveryTimingRuleRow = {
  city: string;
  city_normalized: string;
  cutoff_time: string | null;
  start_time: string | null;
  sla_mode: "SAME_DAY" | "FIXED_HOURS";
  sla_hours: number | null;
};

export type NormalizedOptionalRow = Record<string, string | number | null>;

export type SupportedNormalizedRow =
  | NormalizedDeliveryDetailsRow
  | NormalizedParcelLogRow
  | NormalizedWaOrderRow
  | NormalizedDeliveryTimingRuleRow
  | NormalizedOptionalRow;
