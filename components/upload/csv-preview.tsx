"use client";

import { useMemo, useState } from "react";

import type { CsvRow } from "@/lib/ingest/types";

type CsvPreviewProps = {
  data: CsvRow[];
  filename: string;
  onConfirm: (validRows: CsvRow[]) => void;
  onCancel: () => void;
};

type ValidationIssue = {
  row: number;
  field: string;
  message: string;
  row_data: CsvRow;
};

type ValidationResult = {
  valid: CsvRow[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
};

export function CsvPreview({ data, filename, onConfirm, onCancel }: CsvPreviewProps) {
  const [showWarnings, setShowWarnings] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const validation = useMemo(() => validateCsvData(data), [data]);

  const validCount = validation.valid.length;
  const warningCount = validation.warnings.length;
  const errorCount = validation.errors.length;
  const canImport = validCount > 0;

  return (
    <div className="csv-preview">
      <h3>
        CSV Preview - {filename} ({data.length} rows)
      </h3>

      <div className="preview-summary">
        <div className="summary-item valid">✅ Valid: {validCount} rows ready to import</div>
        <div className="summary-item warning">
          ⚠️ Warnings: {warningCount} rows (can import with defaults)
        </div>
        <div className="summary-item error">❌ Errors: {errorCount} rows (will be skipped)</div>
      </div>

      {warningCount > 0 && (
        <div className="preview-section">
          <button className="expand-btn" onClick={() => setShowWarnings(!showWarnings)}>
            {showWarnings ? "▼" : "▶"} Warnings ({warningCount})
          </button>
          {showWarnings && (
            <div className="preview-list warnings">
              {validation.warnings.slice(0, 20).map((warning, index) => (
                <div key={index} className="preview-row">
                  <span className="row-num">Row {warning.row}:</span>
                  <span className="message">{warning.message}</span>
                </div>
              ))}
              {warningCount > 20 && <p className="more">... and {warningCount - 20} more</p>}
            </div>
          )}
        </div>
      )}

      {errorCount > 0 && (
        <div className="preview-section">
          <button className="expand-btn" onClick={() => setShowErrors(!showErrors)}>
            {showErrors ? "▼" : "▶"} Errors ({errorCount})
          </button>
          {showErrors && (
            <div className="preview-list errors">
              {validation.errors.slice(0, 20).map((error, index) => (
                <div key={index} className="preview-row">
                  <span className="row-num">Row {error.row}:</span>
                  <span className="message">{error.message} - SKIPPED</span>
                </div>
              ))}
              {errorCount > 20 && <p className="more">... and {errorCount - 20} more</p>}
            </div>
          )}
        </div>
      )}

      <div className="preview-actions">
        <button className="btn secondary" onClick={() => exportErrorLog(validation)}>
          📥 Export Error Log
        </button>
        <button className="btn" disabled={!canImport} onClick={() => onConfirm(validation.valid)}>
          Proceed with {validCount + warningCount} rows
        </button>
        <button className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function validateCsvData(data: CsvRow[]): ValidationResult {
  const valid: CsvRow[] = [];
  const warnings: ValidationResult["warnings"] = [];
  const errors: ValidationResult["errors"] = [];

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const rowWarnings: ValidationResult["warnings"] = [];
    let hasError = false;

    if (!row.parcel_id) {
      errors.push({
        row: rowNum,
        field: "parcel_id",
        message: "Missing parcel_id (required field)",
        row_data: row,
      });
      hasError = true;
    }

    if (!row.order_date) {
      errors.push({
        row: rowNum,
        field: "order_date",
        message: "Missing order_date (required field)",
        row_data: row,
      });
      hasError = true;
    }

    if (row.order_date && !isValidDate(row.order_date)) {
      errors.push({
        row: rowNum,
        field: "order_date",
        message: `Invalid date format "${row.order_date}"`,
        row_data: row,
      });
      hasError = true;
    }

    if (!row.zone) {
      rowWarnings.push({
        row: rowNum,
        field: "zone",
        message: "Missing zone - will default to 'UNKNOWN'",
        row_data: row,
      });
    }

    if (!row.city) {
      rowWarnings.push({
        row: rowNum,
        field: "city",
        message: "Missing city - will use zone default",
        row_data: row,
      });
    }

    if (!hasError) {
      valid.push(row);
      warnings.push(...rowWarnings);
    }
  });

  return { valid, warnings, errors };
}

function isValidDate(dateStr: string): boolean {
  const parsed = new Date(dateStr);
  return !Number.isNaN(parsed.getTime());
}

function exportErrorLog(validation: ValidationResult) {
  const log = {
    timestamp: new Date().toISOString(),
    summary: {
      valid: validation.valid.length,
      warnings: validation.warnings.length,
      errors: validation.errors.length,
    },
    warnings: validation.warnings,
    errors: validation.errors,
  };

  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `import_error_log_${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}