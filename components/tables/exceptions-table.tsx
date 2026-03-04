"use client";

import { formatDateMmmDd } from "@/lib/utils/date-format";

type ExceptionRow = {
  id: string;
  warehouse_code: string;
  parcel_id: number | null;
  exception_type: string;
  severity: string;
  status: string;
  description: string;
  detected_at: string;
  aging_hours: number;
};

export function ExceptionsTable({ rows, onUpdate }: { rows: ExceptionRow[]; onUpdate: (id: string, status: "acknowledged" | "resolved") => Promise<void> }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Warehouse</th>
            <th>Parcel</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Aging (h)</th>
            <th>Detected</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.warehouse_code}</td>
              <td>{row.parcel_id ?? "-"}</td>
              <td>{row.exception_type}</td>
              <td>{row.severity}</td>
              <td>{row.status}</td>
              <td>{row.aging_hours}</td>
              <td>{formatDateMmmDd(row.detected_at)}</td>
              <td className="btn-row">
                <button className="btn-ghost" onClick={() => void onUpdate(row.id, "acknowledged")} type="button">Ack</button>
                <button className="btn" onClick={() => void onUpdate(row.id, "resolved")} type="button">Resolve</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
