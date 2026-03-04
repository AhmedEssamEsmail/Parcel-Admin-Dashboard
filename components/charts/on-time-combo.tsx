"use client";

import {
  BarElement,
  BarController,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

type Props = {
  labels: string[];
  totals: number[];
  onTimePct: number[];
  waDeliveredPct: number[];
};

export function OnTimeComboChart({ labels, totals, onTimePct, waDeliveredPct }: Props) {
  const data = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "Total Orders",
        data: totals,
        backgroundColor: "rgba(16, 185, 129, 0.75)",
        borderRadius: 4,
        yAxisID: "y",
      },
      {
        type: "line" as const,
        label: "On Time %",
        data: onTimePct,
        borderColor: "#0f172a",
        pointBackgroundColor: "#0f172a",
        tension: 0.3,
        yAxisID: "y1",
      },
      {
        type: "line" as const,
        label: "WA Delivered %",
        data: waDeliveredPct,
        borderColor: "#f97316",
        pointBackgroundColor: "#f97316",
        tension: 0.3,
        yAxisID: "y1",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Total Orders" },
      },
      y1: {
        beginAtZero: true,
        max: 100,
        position: "right" as const,
        grid: { drawOnChartArea: false },
        title: { display: true, text: "On Time %" },
      },
    },
  };

  return (
    <div className="chart-card">
      <h3>On-Time Performance</h3>
      <div className="chart-wrapper">
        <Chart type="bar" data={data as never} options={options as never} />
      </div>
    </div>
  );
}
