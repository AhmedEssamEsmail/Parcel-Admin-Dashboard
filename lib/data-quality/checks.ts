export type DataQualityIssue = {
  check_id: string;
  check_name: string;
  severity: "critical" | "warning" | "info";
  description: string;
  recommendation?: string;
};

export const DATA_QUALITY_CHECKS: DataQualityIssue[] = [
  {
    check_id: "DQ-001",
    check_name: "Impossible Timestamps",
    severity: "critical",
    description: "delivered_ts is before order_ts",
    recommendation: "Review order timestamps and ensure data source consistency.",
  },
  {
    check_id: "DQ-002",
    check_name: "Missing Zone",
    severity: "warning",
    description: "No zone assigned to order",
    recommendation: "Update zone mappings or set a default zone.",
  },
  {
    check_id: "DQ-003",
    check_name: "Missing City",
    severity: "warning",
    description: "No city assigned to order",
    recommendation: "Update city mappings or set a default city.",
  },
  {
    check_id: "DQ-004",
    check_name: "Missing Area",
    severity: "info",
    description: "No area assigned to order",
    recommendation: "Confirm area mappings for warehouse zones.",
  },
  {
    check_id: "DQ-005",
    check_name: "Duplicate Parcel ID",
    severity: "critical",
    description: "Duplicate parcel_id exists within warehouse",
    recommendation: "Deduplicate parcels and re-run ingestion.",
  },
  {
    check_id: "DQ-006",
    check_name: "Missing Shift Configuration",
    severity: "warning",
    description: "No shift config for today",
    recommendation: "Ensure shift configs exist for each warehouse/day.",
  },
  {
    check_id: "DQ-007",
    check_name: "Order Status Mismatch",
    severity: "warning",
    description: "Delivered timestamp exists but status is not Delivered",
    recommendation: "Align status with delivery timestamp in source data.",
  },
  {
    check_id: "DQ-008",
    check_name: "Missing Collector",
    severity: "info",
    description: "Collector name is missing",
    recommendation: "Populate collector data for operational visibility.",
  },
  {
    check_id: "DQ-009",
    check_name: "Missing On-Time Status",
    severity: "critical",
    description: "is_on_time is NULL for delivered parcel",
    recommendation: "Ensure SLA calculation runs for all delivered parcels.",
  },
  {
    check_id: "DQ-010",
    check_name: "Waiting Address Mismatch",
    severity: "info",
    description: "Waiting address flagged but address is complete",
    recommendation: "Audit waiting address flags for correctness.",
  },
];

export function getDataQualityChecklist() {
  return DATA_QUALITY_CHECKS;
}