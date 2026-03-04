"use client";

import { Line } from "react-chartjs-2";
import { CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";
import { formatDateMmmDd } from "@/lib/utils/date-format";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

type Row = { day: string; promise_hit_rate: number | null };

export function PromiseReliabilityTrendChart({ rows }: { rows: Row[] }) {
  const labels = rows.map((row) => formatDateMmmDd(row.day));

  const data = {
    labels,
    datasets: [{
      label: "Promise Hit Rate %",
      data: rows.map((r) => r.promise_hit_rate ?? 0),
      borderColor: "#0f766e",
      backgroundColor: "#0f766e",
      tension: 0.25,
    }],
  };

  return <div className="chart-wrapper"><Line data={data as never} options={{ responsive: true, maintainAspectRatio: false } as never} /></div>;
}
