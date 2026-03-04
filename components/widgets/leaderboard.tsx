"use client";

import { useEffect, useState } from "react";

import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

type LeaderboardRow = {
  warehouse: string;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
};

export function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const results: LeaderboardRow[] = [];

      for (const code of WAREHOUSE_CODES) {
        const res = await fetch(`/api/wow-summary?warehouse=${code}&periodType=week&limit=1`);
        const json = await res.json();
        const period = json?.periods?.[0];
        results.push({
          warehouse: code,
          otd_pct: period?.otd_pct ?? null,
          avg_delivery_minutes: period?.avg_delivery_minutes ?? null,
        });
      }

      results.sort((a, b) => (b.otd_pct || 0) - (a.otd_pct || 0));
      setRows(results);
      setLoading(false);
    };

    void load();
  }, []);

  if (loading) {
    return <p className="muted">Loading leaderboard...</p>;
  }

  return (
    <div className="leaderboard">
      <h3>Performance Leaderboard</h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Warehouse</th>
              <th>OTD %</th>
              <th>Avg Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.warehouse} className={row.otd_pct && row.otd_pct < 80 ? "warning" : ""}>
                <td>{renderRank(index)}</td>
                <td>{row.warehouse}</td>
                <td className={getOtdClass(row.otd_pct)}>
                  {row.otd_pct?.toFixed(1) ?? "-"}%
                </td>
                <td>{formatTime(row.avg_delivery_minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderRank(index: number): string {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `${index + 1}`;
}

function formatTime(minutes: number | null): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function getOtdClass(value: number | null): string {
  if (!value) return "";
  if (value >= 90) return "excellent";
  if (value >= 80) return "good";
  return "needs-attention";
}