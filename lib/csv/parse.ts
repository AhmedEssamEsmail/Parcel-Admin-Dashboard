import Papa from "papaparse";

import type { CsvRow } from "@/lib/ingest/types";

export async function parseCsvFile(file: File): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0].message));
          return;
        }

        resolve(results.data);
      },
      error: (error) => reject(error),
    });
  });
}
