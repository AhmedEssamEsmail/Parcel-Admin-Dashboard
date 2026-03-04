"use client";

import { Line } from "react-chartjs-2";
import { CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

type Row = { day: string; avg_delivery_minutes: number | null };

export function DwellTrendChart({ rows }: { rows: Row[] }) {
  const data = {
    labels: rows.map((r) => r.day),
    datasets: [{ label: "Avg Delivery Minutes", data: rows.map((r) => r.avg_delivery_minutes ?? 0), borderColor: "#ea580c", backgroundColor: "#ea580c", tension: 0.25 }],
  };
  return <div className="chart-wrapper"><Line data={data as never} options={{ responsive: true, maintainAspectRatio: false } as never} /></div>;
}
