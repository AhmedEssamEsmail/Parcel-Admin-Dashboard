"use client";

import {
  BarElement,
  BarController,
  CategoryScale,
  Chart as ChartJS,
  type ChartOptions,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { formatDateMmmDd } from "@/lib/utils/date-format";

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
  const formattedLabels = labels.map((label) => formatDateMmmDd(label));

  const data = {
    labels: formattedLabels,
    datasets: [
      {
        type: "bar" as const,
        label: "Total Orders",
        data: totals,
        backgroundColor: "rgba(16, 185, 129, 0.75)",
        borderRadius: 4,
        yAxisID: "y",
        order: 3,
      },
      {
        type: "line" as const,
        label: "On Time %",
        data: onTimePct,
        borderColor: "#6b7280",
        pointBackgroundColor: "#6b7280",
        tension: 0.3,
        yAxisID: "y1",
        order: 1,
        borderWidth: 3,
        pointRadius: 3,
      },
      {
        type: "line" as const,
        label: "WA Delivered %",
        data: waDeliveredPct,
        borderColor: "#f97316",
        pointBackgroundColor: "#f97316",
        tension: 0.3,
        yAxisID: "y1",
        order: 1,
        borderWidth: 3,
        pointRadius: 3,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          generateLabels(chart) {
            const base = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
            return base.map((labelItem) => {
              if (labelItem.datasetIndex === undefined) return labelItem;
              const dataset = chart.data.datasets[labelItem.datasetIndex];
              if (dataset?.type !== "line") return labelItem;

              const color =
                (Array.isArray(dataset.borderColor)
                  ? dataset.borderColor[0]
                  : dataset.borderColor) ?? labelItem.strokeStyle;

              return {
                ...labelItem,
                fillStyle: color,
                strokeStyle: color,
                lineWidth: 0,
              };
            });
          },
        },
      },
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
      <div className="chart-wrapper chart-wrapper--on-time">
        <Chart type="bar" data={data as never} options={options as never} />
      </div>
    </div>
  );
}
