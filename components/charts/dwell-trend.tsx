"use client";

import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

import { formatDateMmmDd, formatMinutesToHHMM } from "@/lib/utils/date-format";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

type Row = { day: string; avg_delivery_minutes: number | null };

export function DwellTrendChart({ rows }: { rows: Row[] }) {
  const labels = rows.map((row) => formatDateMmmDd(row.day));

  const data = {
    labels,
    datasets: [
      {
        label: "Avg Delivery Minutes",
        data: rows.map((row) => row.avg_delivery_minutes ?? 0),
        borderColor: "#ea580c",
        backgroundColor: "#ea580c",
        tension: 0.25,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        ticks: {
          callback(value) {
            return formatMinutesToHHMM(Number(value));
          },
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label(context) {
            const value = Number(context.parsed.y);
            return `${context.dataset.label ?? "Value"}: ${formatMinutesToHHMM(value)}`;
          },
        },
      },
    },
  };

  return (
    <div className="chart-wrapper">
      <Line data={data as never} options={options as never} />
    </div>
  );
}
