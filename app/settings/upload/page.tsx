"use client";

import { useMemo, useState } from "react";

import { AppNav } from "@/components/layout/nav";
import { DATASET_OPTIONS } from "@/lib/csv/mappings";
import { detectWarehouseFromRow, inferWarehouseCodeFromText } from "@/lib/csv/warehouse";
import { parseCsvFile } from "@/lib/csv/parse";
import { normalizeDatasetRows } from "@/lib/ingest/normalizers";
import type { CsvRow, DatasetType } from "@/lib/ingest/types";

type UploadFileConfig = {
  id: string;
  file: File;
  rows: CsvRow[];
  datasetType: DatasetType | null;
  warehouseCodes: string[];
  countryLabels: string[];
  unknownWarehouseRows: number;
  detectionErrors: string[];
  ready: boolean;
};

type UploadIssue = {
  fileName: string;
  row: number;
  message: string;
};

const DATASET_HINTS: Array<{ type: DatasetType; hints: string[] }> = [
  { type: "delivery_details", hints: ["delivery details", "delivery detail"] },
  { type: "parcel_logs", hints: ["parcel logs", "parcel log"] },
  {
    type: "items_per_order",
    hints: ["items per order", "items per order report", "items report", "items"],
  },
  {
    type: "collectors_report",
    hints: ["collectors report", "collector report", "collectors"],
  },
  {
    type: "prepare_report",
    hints: ["prepare report", "prepar report", "prep report", "preparer", "prepare"],
  },
  { type: "freshdesk_tickets", hints: ["freshdesk data", "freshdesk", "fresh desk", "tickets"] },
  {
    type: "wa_orders",
    hints: ["wa orders", "waiting address", "wa list", "wa sheet"],
  },
  {
    type: "delivery_timing_rules",
    hints: ["delivery timing", "timing rules", "delivery sla hours"],
  },
];

const WAREHOUSE_COUNTRY_LABELS: Record<string, string> = {
  KUWAIT: "Kuwait",
  RIYADH: "Saudi Arabia",
  DAMMAM: "Saudi Arabia",
  JEDDAH: "Saudi Arabia",
  QATAR: "Qatar",
  UAE: "United Arab Emirates",
  BAHRAIN: "Bahrain",
};

const DATASET_LABEL_MAP = new Map(DATASET_OPTIONS.map((item) => [item.value, item.label]));

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function toSearchable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectDatasetType(fileName: string): DatasetType | null {
  const searchableFileName = toSearchable(fileName);

  for (const item of DATASET_HINTS) {
    if (item.hints.some((hint) => searchableFileName.includes(hint))) {
      return item.type;
    }
  }

  return null;
}

function detectWarehouseCodeForRow(row: CsvRow): string | null {
  const fromCandidates = detectWarehouseFromRow(row).warehouseCode;
  if (fromCandidates) {
    return fromCandidates;
  }

  for (const value of Object.values(row)) {
    if (!value) continue;
    const inferred = inferWarehouseCodeFromText(String(value));
    if (inferred) {
      return inferred;
    }
  }

  return null;
}

function detectWarehouseSummary(rows: CsvRow[]): {
  warehouseCodes: string[];
  unknownWarehouseRows: number;
} {
  const warehouseCodes = new Set<string>();
  let unknownWarehouseRows = 0;

  rows.forEach((row) => {
    const warehouseCode = detectWarehouseCodeForRow(row);
    if (!warehouseCode) {
      unknownWarehouseRows += 1;
      return;
    }
    warehouseCodes.add(warehouseCode);
  });

  return {
    warehouseCodes: Array.from(warehouseCodes).sort(),
    unknownWarehouseRows,
  };
}

function mapCountries(warehouseCodes: string[]): string[] {
  return Array.from(
    new Set(warehouseCodes.map((code) => WAREHOUSE_COUNTRY_LABELS[code] ?? code)),
  ).sort();
}

async function analyzeFile(file: File, index: number): Promise<UploadFileConfig> {
  const id = `${file.name}-${file.lastModified}-${file.size}-${index}`;

  try {
    const rows = await parseCsvFile(file);
    const datasetType = detectDatasetType(file.name);
    const { warehouseCodes, unknownWarehouseRows } = detectWarehouseSummary(rows);

    const detectionErrors: string[] = [];
    if (rows.length === 0) {
      detectionErrors.push("No CSV rows were detected.");
    }
    if (!datasetType) {
      detectionErrors.push("Dataset type could not be detected from the file name.");
    }
    if (warehouseCodes.length === 0) {
      detectionErrors.push("No warehouse/country could be detected from CSV rows.");
    }
    if (unknownWarehouseRows > 0) {
      detectionErrors.push(
        `Warehouse/country detection failed for ${unknownWarehouseRows} row(s).`,
      );
    }

    return {
      id,
      file,
      rows,
      datasetType,
      warehouseCodes,
      countryLabels: mapCountries(warehouseCodes),
      unknownWarehouseRows,
      detectionErrors,
      ready: detectionErrors.length === 0,
    };
  } catch (error) {
    return {
      id,
      file,
      rows: [],
      datasetType: null,
      warehouseCodes: [],
      countryLabels: [],
      unknownWarehouseRows: 0,
      detectionErrors: [
        error instanceof Error ? error.message : "Failed to parse CSV file.",
      ],
      ready: false,
    };
  }
}

type UploadPageContentProps = {
  embedded?: boolean;
};

export function UploadPageContent({ embedded = false }: UploadPageContentProps) {
  const [fileConfigs, setFileConfigs] = useState<UploadFileConfig[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<UploadIssue[]>([]);
  const [warnings, setWarnings] = useState<UploadIssue[]>([]);
  const [result, setResult] = useState<{
    parsed: number;
    inserted: number;
    ignored: number;
    filesProcessed: number;
    warehousesTouched: number;
  } | null>(null);

  const blockingIssues = useMemo(
    () =>
      fileConfigs.flatMap((config) =>
        config.detectionErrors.map((message) => ({ fileName: config.file.name, message })),
      ),
    [fileConfigs],
  );

  const canSubmit =
    fileConfigs.length > 0 &&
    !detecting &&
    !loading &&
    blockingIssues.length === 0 &&
    fileConfigs.every((config) => config.ready);

  const onFileSelection = async (selectedFiles: File[]) => {
    setPreviewOpen(false);
    setErrors([]);
    setWarnings([]);
    setResult(null);

    if (selectedFiles.length === 0) {
      setFileConfigs([]);
      return;
    }

    setDetecting(true);
    const configs = await Promise.all(
      selectedFiles.map((file, index) => analyzeFile(file, index)),
    );
    setFileConfigs(configs);
    setDetecting(false);
  };

  const removeFile = (id: string) => {
    setPreviewOpen(false);
    setFileConfigs((current) => current.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    setPreviewOpen(false);
    setFileConfigs([]);
    setErrors([]);
    setWarnings([]);
    setResult(null);
  };

  const submitWithPreview = () => {
    if (!canSubmit) return;
    setPreviewOpen(true);
  };

  const confirmPreview = async () => {
    if (!canSubmit) return;

    setPreviewOpen(false);
    setLoading(true);
    setErrors([]);
    setWarnings([]);
    setResult(null);

    const uploadErrors: UploadIssue[] = [];
    const uploadWarnings: UploadIssue[] = [];
    const touchedWarehouses = new Set<string>();

    let parsed = 0;
    let inserted = 0;
    let ignored = 0;
    let filesProcessed = 0;

    for (const config of fileConfigs) {
      if (!config.ready || !config.datasetType) {
        continue;
      }

      filesProcessed += 1;
      parsed += config.rows.length;

      const groupedRows = new Map<string, CsvRow[]>();

      config.rows.forEach((row, index) => {
        const warehouseCode = detectWarehouseCodeForRow(row);
        if (!warehouseCode) {
          uploadErrors.push({
            fileName: config.file.name,
            row: index + 2,
            message: "Warehouse/country could not be detected for this row.",
          });
          return;
        }

        const bucket = groupedRows.get(warehouseCode) ?? [];
        bucket.push(row);
        groupedRows.set(warehouseCode, bucket);
      });

      for (const [warehouseCode, rows] of groupedRows) {
        touchedWarehouses.add(warehouseCode);

        const {
          validRows: normalizedRows,
          errors: normalizeErrors,
          warnings: normalizeWarnings,
        } = normalizeDatasetRows(config.datasetType, rows);

        normalizeErrors.forEach((error) => {
          uploadErrors.push({
            fileName: config.file.name,
            row: error.row,
            message: error.message,
          });
        });

        normalizeWarnings.forEach((warning) => {
          uploadWarnings.push({
            fileName: config.file.name,
            row: warning.row,
            message: warning.message,
          });
        });

        if (normalizedRows.length === 0) {
          continue;
        }

        const chunks = chunkArray(normalizedRows, 500);

        for (const chunk of chunks) {
          const response = await fetch("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              warehouseCode,
              datasetType: config.datasetType,
              rows: chunk,
              fileName: config.file.name,
              parsedCount: rows.length,
              warningCount: normalizeWarnings.length,
              errorCount: normalizeErrors.length,
            }),
          });

          const payload = (await response.json()) as {
            insertedCount?: number;
            ignoredCount?: number;
            error?: string;
          };

          if (!response.ok) {
            uploadErrors.push({
              fileName: config.file.name,
              row: 0,
              message: payload.error ?? "Ingestion failed.",
            });
            break;
          }

          inserted += payload.insertedCount ?? 0;
          ignored += payload.ignoredCount ?? 0;
        }
      }
    }

    setErrors(uploadErrors);
    setWarnings(uploadWarnings);
    setResult({
      parsed,
      inserted,
      ignored,
      filesProcessed,
      warehousesTouched: touchedWarehouses.size,
    });
    setLoading(false);
  };

  const content = (
    <>
      <section className="card">
        <h2>Upload CSV Files</h2>
        <label>
          CSV Files
          <input
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={(event) => void onFileSelection(Array.from(event.target.files ?? []))}
            disabled={detecting || loading}
          />
        </label>
        <p className="muted">
          {fileConfigs.length === 0
            ? "No files selected"
            : `${fileConfigs.length} file(s) selected. Dataset and country detection are automatic.`}
        </p>
        {detecting && <p className="muted">Analyzing selected files...</p>}
      </section>

      {fileConfigs.length > 0 && (
        <section className="table-card">
          <h3>Files Ready For Upload</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Detected Dataset</th>
                  <th>Countries Included</th>
                  <th>Warehouse Split</th>
                  <th>Detection</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {fileConfigs.map((config) => (
                  <tr key={config.id}>
                    <td>{config.file.name}</td>
                    <td>
                      {config.datasetType
                        ? (DATASET_LABEL_MAP.get(config.datasetType) ?? config.datasetType)
                        : "Not detected"}
                    </td>
                    <td>{config.countryLabels.length > 0 ? config.countryLabels.join(", ") : "Not detected"}</td>
                    <td>{config.warehouseCodes.length > 0 ? config.warehouseCodes.join(", ") : "-"}</td>
                    <td>
                      <span className="badge">
                        {config.ready ? "Auto" : "Blocked"}
                      </span>
                    </td>
                    <td>
                      <button className="btn-ghost" type="button" onClick={() => removeFile(config.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {blockingIssues.length > 0 && (
        <section className="table-card">
          <h3>Detection Blocking Issues</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Issue</th>
                </tr>
              </thead>
              <tbody>
                {blockingIssues.map((issue, index) => (
                  <tr key={`${issue.fileName}-${index}`}>
                    <td>{issue.fileName}</td>
                    <td>{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card upload-actions">
        <p className="muted">
          {fileConfigs.length === 0
            ? "Select one or more CSV files to upload."
            : `${fileConfigs.length} file(s) ready for preview.`}
        </p>
        <div className="btn-row">
          <button className="btn-ghost" type="button" onClick={clearAll} disabled={loading || detecting || fileConfigs.length === 0}>
            Clear
          </button>
          <button
            className="upload-submit-btn"
            type="button"
            onClick={submitWithPreview}
            disabled={!canSubmit}
          >
            {loading ? "Uploading..." : "Preview & Upload"}
          </button>
        </div>
      </section>

      {previewOpen && (
        <section className="card">
          <h3>Upload Preview</h3>
          <p className="muted">
            All selected files will upload in one run, and each file will be auto-split by detected warehouse.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Dataset</th>
                  <th>Countries Included</th>
                  <th>Rows</th>
                  <th>Detected Warehouses</th>
                </tr>
              </thead>
              <tbody>
                {fileConfigs.map((config) => (
                  <tr key={`preview-${config.id}`}>
                    <td>{config.file.name}</td>
                    <td>
                      {config.datasetType
                        ? (DATASET_LABEL_MAP.get(config.datasetType) ?? config.datasetType)
                        : "Not detected"}
                    </td>
                    <td>{config.countryLabels.join(", ")}</td>
                    <td>{config.rows.length}</td>
                    <td>{config.warehouseCodes.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" type="button" onClick={() => void confirmPreview()} disabled={loading}>
              {loading ? "Uploading..." : "Confirm Upload"}
            </button>
            <button className="btn-ghost" type="button" onClick={() => setPreviewOpen(false)} disabled={loading}>
              Back
            </button>
          </div>
        </section>
      )}

      {result && (
        <section className="card success">
          Parsed: {result.parsed} | Inserted: {result.inserted} | Ignored: {result.ignored} | Files: {result.filesProcessed} | Warehouses: {result.warehousesTouched}
        </section>
      )}

      {errors.length > 0 && (
        <section className="table-card">
          <h3>Validation / Ingestion Errors</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Row</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((error, index) => (
                  <tr key={`${error.fileName}-${error.row}-${index}`}>
                    <td>{error.fileName}</td>
                    <td>{error.row > 0 ? error.row : "-"}</td>
                    <td>{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {warnings.length > 0 && (
        <section className="table-card">
          <h3>Upload Warnings</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Row</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {warnings.map((warning, index) => (
                  <tr key={`${warning.fileName}-${warning.row}-${index}`}>
                    <td>{warning.fileName}</td>
                    <td>{warning.row > 0 ? warning.row : "-"}</td>
                    <td>{warning.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <main className="page-wrap">
      <AppNav />
      {content}
    </main>
  );
}

export default function UploadPage() {
  return <UploadPageContent />;
}
