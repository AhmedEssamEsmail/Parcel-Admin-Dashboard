import type { DatasetType } from "@/lib/ingest/types";

export const WAREHOUSE_CODES = [
  "KUWAIT",
  "RIYADH",
  "DAMMAM",
  "JEDDAH",
  "QATAR",
  "UAE",
  "BAHRAIN",
] as const;

export const DATASET_OPTIONS: { value: DatasetType; label: string }[] = [
  { value: "delivery_details", label: "Delivery Details" },
  { value: "parcel_logs", label: "Parcel Logs" },
  { value: "items_per_order", label: "Items Per Order (optional)" },
  { value: "collectors_report", label: "Collectors Report (optional)" },
  { value: "prepare_report", label: "Prepare Report (optional)" },
  { value: "freshdesk_tickets", label: "Freshdesk (optional)" },
  { value: "wa_orders", label: "WA Orders (optional)" },
  { value: "delivery_timing_rules", label: "Delivery Timing Rules (optional)" },
];
