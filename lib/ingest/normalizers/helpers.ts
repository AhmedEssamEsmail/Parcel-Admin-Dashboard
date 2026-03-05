import type { CsvRow } from "@/lib/ingest/types";

function normalizeFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function getField(row: CsvRow, keys: string[]): string {
  const map = new Map<string, string>();
  for (const key of Object.keys(row)) {
    const normalized = normalizeFieldKey(key);
    if (!normalized || map.has(normalized)) continue;
    map.set(normalized, key);
  }

  for (const key of keys) {
    const hit = map.get(normalizeFieldKey(key));
    if (hit) return row[hit] ?? "";
  }

  return "";
}
