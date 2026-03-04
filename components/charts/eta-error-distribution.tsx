"use client";

import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { formatDateMmmDd } from "@/lib/utils/date-format";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Row = { day: string; avg_eta_error_minutes: number | null };

export function EtaErrorDistributionChart({ rows }: { rows: Row[] }) {
  const labels = rows.map((row) => formatDateMmmDd(row.day));
  const data = {
    labels,
    datasets: [
      {
        label: "Avg ETA Error (min)",
        data: rows.map((r) => r.avg_eta_error_minutes ?? 0),
        backgroundColor: "rgba(99,102,241,0.7)",
      },
    ],
  };
  return <div className="chart-wrapper"><Bar data={data as never} options={{ responsive: true, maintainAspectRatio: false } as never} /></div>;
}
