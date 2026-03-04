"use client";

type Row = {
  warehouse_code: string;
  day: string;
  city: string;
  total_orders: number;
  delivered_count: number;
  on_time_count: number;
  active_areas: number;
  parcels_per_active_area: number | null;
  avg_delivery_minutes: number | null;
  otd_pct: number | null;
};

export function RouteEfficiencyTable({ rows }: { rows: Row[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>Day</th><th>Warehouse</th><th>City</th><th>Total</th><th>Delivered</th><th>On-Time</th><th>Active Areas</th><th>Parcels/Area</th><th>Avg Minutes</th><th>OTD %</th></tr></thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.day}-${row.city}-${idx}`}>
              <td>{row.day}</td><td>{row.warehouse_code}</td><td>{row.city}</td><td>{row.total_orders}</td><td>{row.delivered_count}</td><td>{row.on_time_count}</td><td>{row.active_areas}</td><td>{row.parcels_per_active_area?.toFixed(2) ?? "-"}</td><td>{row.avg_delivery_minutes?.toFixed(2) ?? "-"}</td><td>{row.otd_pct?.toFixed(2) ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
