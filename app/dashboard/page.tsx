"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { OnTimeComboChart } from "@/components/charts/on-time-combo";
import { AppNav } from "@/components/layout/nav";
import { DodSummaryTable } from "@/components/tables/dod-summary-table";
import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

type DodRow = {
  day: string;
  total_orders: number;
  on_time: number;
  late: number;
  on_time_pct: number | null;
};

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const [warehouse, setWarehouse] = useState<string>("ALL");
  const [from, setFrom] = useState<string>(dateOffset(-45));
  const [to, setTo] = useState<string>(dateOffset(0));
  const [rows, setRows] = useState<DodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ warehouse, from, to });
      const response = await fetch(`/api/dod?${params.toString()}`);
      const payload = (await response.json()) as {
        rows?: DodRow[];
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Failed to load dashboard data.");
        return;
      }

      setRows(payload.rows ?? []);
    } catch {
      setError("Network error while loading dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [warehouse, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(
    () => ({
      labels: rows.map((row) => row.day),
      totals: rows.map((row) => row.total_orders),
      onTimePct: rows.map((row) => (row.on_time_pct ?? 0) * 100),
    }),
    [rows],
  );

  return (
    <main className="page-wrap">
      <AppNav />

      <section className="card grid two">
        <label>
          Warehouse
          <select value={warehouse} onChange={(event) => setWarehouse(event.target.value)}>
            <option value="ALL">All Warehouses</option>
            {WAREHOUSE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label>
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>

        <label>
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>

        <div className="btn-row" style={{ alignItems: "end" }}>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <OnTimeComboChart
        labels={chartData.labels}
        totals={chartData.totals}
        onTimePct={chartData.onTimePct}
      />

      <DodSummaryTable rows={rows} />
    </main>
  );
}
