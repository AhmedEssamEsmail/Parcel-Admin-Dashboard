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
            <th>Total</th>
            <th>Delivered (Order Date)</th>
            <th>Delivered (Delivery Date)</th>
            <th>On-Time</th>
            <th>Active Areas</th>
            <th>Parcels/Area</th>
            <th>Avg Minutes</th>
            <th>OTD %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day}>
              <td>{formatDateMmmDd(row.day)}</td>
              <td>{row.total_orders}</td>
              <td>{row.delivered_count}</td>
              <td>{row.delivered_count_delivery_date}</td>
              <td>{row.on_time_count}</td>
              <td>{row.active_areas}</td>
              <td>{row.parcels_per_active_area?.toFixed(2) ?? "-"}</td>
              <td>{formatMinutesToHHMM(row.avg_delivery_minutes)}</td>
              <td>{row.otd_pct?.toFixed(2) ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
