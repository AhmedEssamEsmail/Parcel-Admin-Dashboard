import type { CsvRow } from "@/lib/ingest/types";

export function getField(row: CsvRow, keys: string[]): string {
  const map = new Map<string, string>();
  for (const key of Object.keys(row)) {
    map.set(key.trim().toLowerCase(), key);
  }

  for (const key of keys) {
    const hit = map.get(key.trim().toLowerCase());
    if (hit) return row[hit] ?? "";
  }

  return "";
}
