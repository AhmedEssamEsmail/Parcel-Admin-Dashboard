"use client";

import { formatDateMmmDd } from "@/lib/utils/date-format";

type Row = {
  warehouse_code: string;
  day: string;
  city: string;
  total_orders: number;
  delivered_with_promise: number;
  within_promise_window: number;
  promise_hit_rate: number | null;
  avg_eta_error_minutes: number | null;
};

export function PromiseReliabilityTable({ rows }: { rows: Row[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>Day</th><th>Warehouse</th><th>City</th><th>Total</th><th>Delivered w/ Promise</th><th>Within Window</th><th>Hit Rate %</th><th>Avg ETA Error (min)</th></tr></thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.day}-${row.warehouse_code}-${row.city}-${idx}`}>
              <td>{formatDateMmmDd(row.day)}</td><td>{row.warehouse_code}</td><td>{row.city}</td><td>{row.total_orders}</td><td>{row.delivered_with_promise}</td><td>{row.within_promise_window}</td><td>{row.promise_hit_rate?.toFixed(2) ?? "-"}</td><td>{row.avg_eta_error_minutes?.toFixed(2) ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
