"use client";

import { useMemo, useState } from "react";

import { AppNav } from "@/components/layout/nav";
import { DATASET_OPTIONS, WAREHOUSE_CODES } from "@/lib/csv/mappings";
import { parseCsvFile } from "@/lib/csv/parse";
import { normalizeDatasetRows } from "@/lib/ingest/normalizers";
import type { DatasetType, IngestError } from "@/lib/ingest/types";

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export default function UploadPage() {
  const [warehouseCode, setWarehouseCode] = useState<string>("KUWAIT");
  const [datasetType, setDatasetType] = useState<DatasetType>("delivery_details");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<IngestError[]>([]);
  const [result, setResult] = useState<{
    parsed: number;
    inserted: number;
    ignored: number;
  } | null>(null);

  const canSubmit = files.length > 0 && !loading;

  const fileNames = useMemo(() => files.map((file) => file.name).join(", "), [files]);

  const upload = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setErrors([]);
    setResult(null);

    try {
      let parsedCount = 0;
      let insertedCount = 0;
      let ignoredCount = 0;
      const collectedErrors: IngestError[] = [];

      for (const file of files) {
        const csvRows = await parseCsvFile(file);
        parsedCount += csvRows.length;

        const { validRows, errors: normalizeErrors } = normalizeDatasetRows(datasetType, csvRows);
        collectedErrors.push(
          ...normalizeErrors.map((error) => ({
            ...error,
            message: `${file.name}: ${error.message}`,
          })),
        );

        if (validRows.length === 0) {
          continue;
        }

        const chunks = chunkArray(validRows, 500);

        for (const chunk of chunks) {
          const response = await fetch("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              warehouseCode,
              datasetType,
              rows: chunk,
            }),
          });

          const payload = (await response.json()) as {
            insertedCount?: number;
            ignoredCount?: number;
            error?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "Ingestion failed.");
          }

          insertedCount += payload.insertedCount ?? 0;
          ignoredCount += payload.ignoredCount ?? 0;
        }
      }

      setErrors(collectedErrors);
      setResult({ parsed: parsedCount, inserted: insertedCount, ignored: ignoredCount });
    } catch (error) {
      setErrors([
        {
          row: 0,
          message: error instanceof Error ? error.message : "Upload failed.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-wrap">
      <AppNav />

      <section className="card grid two">
        <label>
          Warehouse
          <select
            value={warehouseCode}
            onChange={(event) => setWarehouseCode(event.target.value)}
          >
            {WAREHOUSE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label>
          Dataset Type
          <select
            value={datasetType}
            onChange={(event) => setDatasetType(event.target.value as DatasetType)}
          >
            {DATASET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ gridColumn: "1 / -1" }}>
          CSV Files
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </label>

        <p className="muted" style={{ gridColumn: "1 / -1" }}>
          {fileNames || "No files selected"}
        </p>

        <div className="btn-row" style={{ gridColumn: "1 / -1" }}>
          <button className="btn" type="button" onClick={() => void upload()} disabled={!canSubmit}>
            {loading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </section>

      {result && (
        <section className="card success">
          Parsed: {result.parsed} | Inserted: {result.inserted} | Ignored: {result.ignored}
        </section>
      )}

      {errors.length > 0 && (
        <section className="table-card">
          <h3>Validation / Ingestion Errors</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((error, index) => (
                  <tr key={`${error.row}-${index}`}>
                    <td>{error.row}</td>
                    <td>{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
