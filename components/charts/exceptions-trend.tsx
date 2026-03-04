"use client";

import { Line } from "react-chartjs-2";
import { CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";
import { formatDateMmmDd } from "@/lib/utils/date-format";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

type TrendRow = { day: string; severity: string; open_count: number };

export function ExceptionsTrendChart({ rows }: { rows: TrendRow[] }) {
  const rawLabels = Array.from(new Set(rows.map((row) => row.day))).sort();
  const labels = rawLabels.map((label) => formatDateMmmDd(label));
  const severities = ["critical", "warning", "info"] as const;
  const colors = { critical: "#dc2626", warning: "#d97706", info: "#2563eb" };

  const data = {
    labels,
    datasets: severities.map((sev) => ({
      label: `${sev} open`,
      data: rawLabels.map((day) =>
        rows
          .filter((row) => row.day === day && row.severity === sev)
          .reduce((sum, row) => sum + row.open_count, 0),
      ),
      borderColor: colors[sev],
      backgroundColor: colors[sev],
      tension: 0.25,
    })),
  };

  return <div className="chart-wrapper"><Line data={data as never} options={{ responsive: true, maintainAspectRatio: false } as never} /></div>;
}
