"use client";

import { useEffect, useState } from "react";

import { AppNav } from "@/components/layout/nav";
import { DATASET_OPTIONS, WAREHOUSE_CODES } from "@/lib/csv/mappings";
import { parseCsvFile } from "@/lib/csv/parse";
import { normalizeDatasetRows } from "@/lib/ingest/normalizers";
import type { DatasetType, IngestError } from "@/lib/ingest/types";

const DEFAULTS_STORAGE_KEY = "parcel-admin-upload-defaults-v1";

type UploadDefaults = {
  warehouseCode: string;
  datasetType: DatasetType;
};

type UploadFileConfig = {
  id: string;
  file: File;
  warehouseCode: string;
  datasetType: DatasetType;
  warehouseAutoDetected: boolean;
  datasetAutoDetected: boolean;
};

type DetectResult<T> = {
  value: T;
  autoDetected: boolean;
};

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

const DATASET_HINTS: Array<{ type: DatasetType; hints: string[] }> = [
  { type: "delivery_details", hints: ["delivery details", "delivery detail"] },
  { type: "parcel_logs", hints: ["parcel logs", "parcel log"] },
  {
    type: "items_per_order",
    hints: ["items per order", "items report", "items"] ,
  },
  {
    type: "collectors_report",
    hints: ["collectors report", "collector report", "collectors"],
  },
  { type: "prepare_report", hints: ["prepare report", "preparer", "prepare"] },
  { type: "freshdesk_tickets", hints: ["freshdesk", "fresh desk", "tickets"] },
];

const WAREHOUSE_HINTS: Array<{ code: string; hints: string[] }> = [
  { code: "KUWAIT", hints: ["kuwait"] },
  { code: "RIYADH", hints: ["riyadh"] },
  { code: "DAMMAM", hints: ["dammam"] },
  { code: "JEDDAH", hints: ["jeddah"] },
  { code: "QATAR", hints: ["qatar", "doha"] },
  { code: "UAE", hints: ["uae", "united arab emirates", "dubai", "abu dhabi"] },
  { code: "BAHRAIN", hints: ["bahrain", "manama"] },
];

function detectDatasetType(fileName: string, fallback: DatasetType): DetectResult<DatasetType> {
  const searchableFileName = toSearchable(fileName);

  for (const item of DATASET_HINTS) {
    if (item.hints.some((hint) => searchableFileName.includes(hint))) {
      return { value: item.type, autoDetected: true };
    }
  }

  return { value: fallback, autoDetected: false };
}

function detectWarehouseCode(fileName: string, fallback: string): DetectResult<string> {
  const searchableFileName = toSearchable(fileName);

  for (const item of WAREHOUSE_HINTS) {
    if (item.hints.some((hint) => searchableFileName.includes(hint))) {
      return { value: item.code, autoDetected: true };
    }
  }

  return { value: fallback, autoDetected: false };
}

function toUploadFileConfig(file: File, index: number, defaults: UploadDefaults): UploadFileConfig {
  const datasetDetection = detectDatasetType(file.name, defaults.datasetType);
  const warehouseDetection = detectWarehouseCode(file.name, defaults.warehouseCode);

  return {
    id: `${file.name}-${file.lastModified}-${file.size}-${index}`,
    file,
    warehouseCode: warehouseDetection.value,
    datasetType: datasetDetection.value,
    warehouseAutoDetected: warehouseDetection.autoDetected,
    datasetAutoDetected: datasetDetection.autoDetected,
  };
}

export default function UploadPage() {
  const [defaultWarehouseCode, setDefaultWarehouseCode] = useState<string>("KUWAIT");
  const [defaultDatasetType, setDefaultDatasetType] = useState<DatasetType>("delivery_details");
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  const [fileConfigs, setFileConfigs] = useState<UploadFileConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<IngestError[]>([]);
  const [result, setResult] = useState<{
    parsed: number;
    inserted: number;
    ignored: number;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DEFAULTS_STORAGE_KEY);
      if (!raw) {
        setDefaultsLoaded(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<UploadDefaults>;

      if (
        typeof parsed.warehouseCode === "string" &&
        WAREHOUSE_CODES.includes(parsed.warehouseCode as (typeof WAREHOUSE_CODES)[number])
      ) {
        setDefaultWarehouseCode(parsed.warehouseCode);
      }

      if (
        typeof parsed.datasetType === "string" &&
        DATASET_OPTIONS.some((option) => option.value === parsed.datasetType)
      ) {
        setDefaultDatasetType(parsed.datasetType as DatasetType);
      }
    } finally {
      setDefaultsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!defaultsLoaded) return;

    const defaults: UploadDefaults = {
      warehouseCode: defaultWarehouseCode,
      datasetType: defaultDatasetType,
    };

    window.localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(defaults));
  }, [defaultWarehouseCode, defaultDatasetType, defaultsLoaded]);

  const canSubmit = fileConfigs.length > 0 && !loading;
  const uploadDisabled = fileConfigs.length === 0 || loading;

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

      for (const config of fileConfigs) {
        let csvRows: Record<string, string>[];

        try {
          csvRows = await parseCsvFile(config.file);
        } catch (error) {
          collectedErrors.push({
            row: 0,
            message: `${config.file.name}: ${
              error instanceof Error ? error.message : "Failed to parse CSV."
            }`,
          });
          continue;
        }

        parsedCount += csvRows.length;

        const { validRows, errors: normalizeErrors } = normalizeDatasetRows(
          config.datasetType,
          csvRows,
        );

        collectedErrors.push(
          ...normalizeErrors.map((error) => ({
            ...error,
            message: `${config.file.name}: ${error.message}`,
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
              warehouseCode: config.warehouseCode,
              datasetType: config.datasetType,
              rows: chunk,
            }),
          });

          const payload = (await response.json()) as {
            insertedCount?: number;
            ignoredCount?: number;
            error?: string;
          };

          if (!response.ok) {
            collectedErrors.push({
              row: 0,
              message: `${config.file.name}: ${payload.error ?? "Ingestion failed."}`,
            });
            break;
          }

          insertedCount += payload.insertedCount ?? 0;
          ignoredCount += payload.ignoredCount ?? 0;
        }
      }

      if (fileConfigs.length > 0) {
        const last = fileConfigs[fileConfigs.length - 1];
        setDefaultWarehouseCode(last.warehouseCode);
        setDefaultDatasetType(last.datasetType);
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

  const onFileSelection = (selectedFiles: File[]) => {
    const defaults: UploadDefaults = {
      warehouseCode: defaultWarehouseCode,
      datasetType: defaultDatasetType,
    };

    const configs = selectedFiles.map((file, index) => toUploadFileConfig(file, index, defaults));

    setFileConfigs(configs);
    setErrors([]);
    setResult(null);
  };

  const updateFileConfig = (
    id: string,
    patch: Partial<Pick<UploadFileConfig, "warehouseCode" | "datasetType">>,
  ) => {
    setFileConfigs((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        return {
          ...item,
          ...patch,
          warehouseAutoDetected:
            patch.warehouseCode === undefined ? item.warehouseAutoDetected : false,
          datasetAutoDetected:
            patch.datasetType === undefined ? item.datasetAutoDetected : false,
        };
      }),
    );
  };

  const removeFile = (id: string) => {
    setFileConfigs((current) => current.filter((item) => item.id !== id));
  };

  return (
    <main className="page-wrap">
      <AppNav />

      <section className="card grid two">
        <label>
          Default Warehouse (remembered)
          <select
            value={defaultWarehouseCode}
            onChange={(event) => setDefaultWarehouseCode(event.target.value)}
          >
            {WAREHOUSE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label>
          Default Dataset Type (remembered)
          <select
            value={defaultDatasetType}
            onChange={(event) => setDefaultDatasetType(event.target.value as DatasetType)}
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
            onChange={(event) => onFileSelection(Array.from(event.target.files ?? []))}
          />
        </label>

        <p className="muted" style={{ gridColumn: "1 / -1" }}>
          {fileConfigs.length === 0
            ? "No files selected"
            : `${fileConfigs.length} file(s) selected. Dataset and warehouse are auto-filled from file names when possible.`}
        </p>
      </section>

      {fileConfigs.length > 0 && (
        <section className="table-card">
          <h3>Files Ready For Upload</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Warehouse</th>
                  <th>Dataset</th>
                  <th>Detection</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {fileConfigs.map((config) => (
                  <tr key={config.id}>
                    <td>{config.file.name}</td>
                    <td>
                      <select
                        value={config.warehouseCode}
                        onChange={(event) =>
                          updateFileConfig(config.id, { warehouseCode: event.target.value })
                        }
                      >
                        {WAREHOUSE_CODES.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={config.datasetType}
                        onChange={(event) =>
                          updateFileConfig(config.id, {
                            datasetType: event.target.value as DatasetType,
                          })
                        }
                      >
                        {DATASET_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="badge">
                        {config.warehouseAutoDetected || config.datasetAutoDetected
                          ? "Auto"
                          : "Default"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-ghost"
                        type="button"
                        onClick={() => removeFile(config.id)}
                      >
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

      <section className="card upload-actions">
        <p className="muted">
          {fileConfigs.length === 0
            ? "Select one or more CSV files to upload."
            : `${fileConfigs.length} file(s) ready.`}
        </p>
        <div className="btn-row">
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setFileConfigs([])}
            disabled={loading || fileConfigs.length === 0}
          >
            Clear
          </button>
          <button
            className={`upload-submit-btn ${uploadDisabled ? "is-disabled" : ""}`}
            type="button"
            onClick={() => {
              if (uploadDisabled) return;
              void upload();
            }}
            aria-disabled={uploadDisabled}
          >
            {loading ? "Uploading..." : "Upload Files"}
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
