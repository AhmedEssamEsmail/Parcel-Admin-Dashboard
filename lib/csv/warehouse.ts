import type { CsvRow } from "@/lib/ingest/types";

const WAREHOUSE_ALIASES: Array<{ code: string; aliases: string[] }> = [
  { code: "KUWAIT", aliases: ["kuwait"] },
  { code: "RIYADH", aliases: ["riyadh"] },
  { code: "DAMMAM", aliases: ["dammam"] },
  { code: "JEDDAH", aliases: ["jeddah"] },
  { code: "QATAR", aliases: ["qatar", "doha"] },
  { code: "UAE", aliases: ["uae", "united arab emirates", "dubai", "abu dhabi"] },
  { code: "BAHRAIN", aliases: ["bahrain", "manama"] },
];

const WAREHOUSE_FIELD_CANDIDATES = [
  "warehouse",
  "warehouse_name",
  "country",
  "country_name",
  "name_en",
] as const;

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFieldCaseInsensitive(row: CsvRow, key: string): string | null {
  for (const rowKey of Object.keys(row)) {
    if (rowKey.trim().toLowerCase() === key) {
      const value = row[rowKey];
      if (!value) return null;
      const trimmed = String(value).trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }

  return null;
}

export function inferWarehouseCodeFromText(value: string): string | null {
  const normalized = normalize(value);
  if (!normalized) return null;

  for (const entry of WAREHOUSE_ALIASES) {
    if (entry.aliases.some((alias) => normalized.includes(alias))) {
      return entry.code;
    }
  }

  return null;
}

export function detectWarehouseFromRow(row: CsvRow): {
  warehouseCode: string | null;
  sourceValue: string | null;
} {
  let firstUnrecognizedValue: string | null = null;

  for (const key of WAREHOUSE_FIELD_CANDIDATES) {
    const value = getFieldCaseInsensitive(row, key);
    if (!value) continue;

    const inferred = inferWarehouseCodeFromText(value);
    if (inferred) {
      return {
        warehouseCode: inferred,
        sourceValue: value,
      };
    }

    if (!firstUnrecognizedValue) {
      firstUnrecognizedValue = value;
    }
  }

  return { warehouseCode: null, sourceValue: firstUnrecognizedValue };
}
