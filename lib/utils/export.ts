type ExportOptions = {
  type: string;
  warehouse?: string | null;
  from?: string | null;
  to?: string | null;
};

export function generateCsv(
  data: Record<string, string | number | boolean | null>[],
  type: string,
  warehouse?: string | null,
  from?: string | null,
  to?: string | null,
): string {
  if (data.length === 0) return "";

  const header = buildHeader({ type, warehouse, from, to });
  const keys = Object.keys(data[0]);
  const csvRows = [keys.join(",")];

  for (const row of data) {
    const values = keys.map((key) => {
      const val = row[key];
      if (val === null || val === undefined) return "";
      if (typeof val === "string" && val.includes(",")) return `"${val}"`;
      return String(val);
    });
    csvRows.push(values.join(","));
  }

  return header + csvRows.join("\n");
}

function buildHeader({ type, warehouse, from, to }: ExportOptions): string {
  const dateRange = from && to ? `${from} to ${to}` : "All dates";

  return `# Parcel Admin Dashboard Export
# Type: ${type}
# Warehouse: ${warehouse ?? "All"}
# Date Range: ${dateRange}
# Exported: ${new Date().toISOString()}
#
# Delivered (%): delivered among orders placed in the selected period
# Delivered (Overall): delivered in the selected period regardless of placed date
# OTD Calculation: (on_time_count / delivered_count_order_date) * 100
# Avg Time Calculation: AVG(delivered_ts - order_ts) in minutes
#
`;
}
