"use client";

import Link from "next/link";

import { buildParcelDetailHref } from "@/lib/navigation/links";
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
  assignee?: string | null;
  category?: string | null;
  due_at?: string | null;
  resolution?: string | null;
  notes?: string | null;
};

export function ExceptionsTable({
  rows,
  selectedIds,
  onToggle,
  onUpdate,
}: {
  rows: ExceptionRow[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onUpdate: (id: string, status: "acknowledged" | "resolved") => Promise<void>;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Select</th>
            <th>Warehouse</th>
            <th className="metric-cell">Parcel</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Assignee</th>
            <th>Category</th>
            <th className="metric-cell">Aging (h)</th>
            <th>Detected</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const parcelHref = buildParcelDetailHref(row.warehouse_code, row.parcel_id);
            const checked = selectedIds.includes(row.id);
            return (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onToggle(row.id, event.target.checked)}
                  />
                </td>
                <td>{row.warehouse_code}</td>
                <td className="metric-cell">{parcelHref ? <Link href={parcelHref}>{row.parcel_id}</Link> : "-"}</td>
                <td>{row.exception_type}</td>
                <td>{row.severity}</td>
                <td>{row.status}</td>
                <td>{row.assignee ?? "-"}</td>
                <td>{row.category ?? "-"}</td>
                <td className="metric-cell">{row.aging_hours}</td>
                <td>{formatDateMmmDd(row.detected_at)}</td>
                <td className="btn-row">
                  <button className="btn-ghost" onClick={() => void onUpdate(row.id, "acknowledged")} type="button">Ack</button>
                  <button className="btn" onClick={() => void onUpdate(row.id, "resolved")} type="button">Resolve</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
