"use client";

import { formatDateMmmDd, formatMinutesToHHMM } from "@/lib/utils/date-format";

type DailyRow = {
  day: string;
  total_orders: number;
  delivered_count: number;
  delivered_count_delivery_date: number;
  on_time_count: number;
  active_areas: number;
  parcels_per_active_area: number | null;
  avg_delivery_minutes: number | null;
  otd_pct: number | null;
};

export function RouteEfficiencyDailyTable({ rows }: { rows: DailyRow[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Day</th>
            <th className="metric-cell">Total</th>
            <th className="metric-cell">Delivered (%)</th>
            <th className="metric-cell">Delivered (Overall)</th>
            <th className="metric-cell">On-Time</th>
            <th className="metric-cell">Active Areas</th>
            <th className="metric-cell">Parcels/Area</th>
            <th className="metric-cell">Avg Minutes</th>
            <th className="metric-cell">OTD %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day}>
              <td>{formatDateMmmDd(row.day)}</td>
              <td className="metric-cell">{row.total_orders}</td>
              <td className="metric-cell">{row.delivered_count}</td>
              <td className="metric-cell">{row.delivered_count_delivery_date}</td>
              <td className="metric-cell">{row.on_time_count}</td>
              <td className="metric-cell">{row.active_areas}</td>
              <td className="metric-cell">{row.parcels_per_active_area?.toFixed(2) ?? "-"}</td>
              <td className="metric-cell">{formatMinutesToHHMM(row.avg_delivery_minutes)}</td>
              <td className="metric-cell">{row.otd_pct?.toFixed(2) ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
