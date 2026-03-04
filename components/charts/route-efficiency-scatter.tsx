"use client";

import { Scatter } from "react-chartjs-2";
import { Chart as ChartJS, Legend, LinearScale, PointElement, Tooltip } from "chart.js";

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

type Row = { parcels_per_active_area: number | null; otd_pct: number | null };

export function RouteEfficiencyScatterChart({ rows }: { rows: Row[] }) {
  const data = {
    datasets: [
      {
        label: "OTD vs Parcels/Area",
        data: rows
          .filter((r) => r.parcels_per_active_area !== null && r.otd_pct !== null)
          .map((r) => ({ x: r.parcels_per_active_area as number, y: r.otd_pct as number })),
        backgroundColor: "rgba(14,116,144,0.75)",
      },
    ],
  };

  return <div className="chart-wrapper"><Scatter data={data as never} options={{ responsive: true, maintainAspectRatio: false } as never} /></div>;
}
