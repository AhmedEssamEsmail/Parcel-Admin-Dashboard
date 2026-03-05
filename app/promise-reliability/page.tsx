"use client";

import { useCallback, useEffect, useState } from "react";

import { GlobalFilters } from "@/components/filters/global-filters";
import { AppNav } from "@/components/layout/nav";
import { PromiseReliabilityTrendChart } from "@/components/charts/promise-reliability-trend";
import { PromiseReliabilityTable } from "@/components/tables/promise-reliability-table";
import { useGlobalFilters } from "@/lib/filters/useGlobalFilters";

type Row = {
  warehouse_code: string;
  day: string;
  city: string;
  total_orders: number;
  delivered_with_promise: number;
  within_promise_window: number;
  promise_hit_rate: number | null;
  avg_eta_error_minutes: number | null;
};

type HistogramBucket = { bucket: string; count: number; pct_late: number };

type EtaBin = { label: string; count: number };

export default function PromiseReliabilityPage() {
  const { filters, setFilters, appliedFilters, applyFilters } = useGlobalFilters({
    warehouse: "ALL",
    fromOffsetDays: -30,
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [histogram, setHistogram] = useState<HistogramBucket[]>([]);
  const [summary, setSummary] = useState<{ delivered_with_promise: number; on_time: number; late: number } | null>(null);
  const [etaBins, setEtaBins] = useState<EtaBin[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams(appliedFilters);
    const [reliabilityRes, histogramRes, etaRes] = await Promise.all([
      fetch(`/api/promise-reliability?${params.toString()}`),
      fetch(`/api/sla-breach-histogram?${params.toString()}`),
      fetch(`/api/distributions/eta-error?${params.toString()}`),
    ]);

    const reliabilityPayload = (await reliabilityRes.json()) as { rows?: Row[] };
    const histogramPayload = (await histogramRes.json()) as {
      summary?: { delivered_with_promise: number; on_time: number; late: number };
      buckets?: HistogramBucket[];
    };
    const etaPayload = (await etaRes.json()) as { signed_bins?: EtaBin[] };

    setRows(reliabilityPayload.rows ?? []);
    setSummary(histogramPayload.summary ?? null);
    setHistogram(histogramPayload.buckets ?? []);
    setEtaBins(etaPayload.signed_bins ?? []);
  }, [appliedFilters]);

  useEffect(() => {
    let active = true;
    const runLoad = async () => {
      if (!active) return;
      await load();
    };
    void runLoad();
    return () => {
      active = false;
    };
  }, [load]);

  return (
    <main className="page-wrap">
      <AppNav />
      <header className="page-header">
        <h1>Promise Reliability</h1>
        <p className="muted">Track promise-window adherence and ETA error trends.</p>
      </header>
      <GlobalFilters filters={filters} onChange={setFilters} onApply={() => applyFilters()} />

      <section className="card">
        <h3>Promise Hit Rate Trend</h3>
        <PromiseReliabilityTrendChart rows={rows} />
      </section>

      <section className="card">
        <h3>SLA Breach Histogram</h3>
        <p className="muted">
          Delivered: {summary?.delivered_with_promise ?? 0} | On-Time: {summary?.on_time ?? 0} | Late: {summary?.late ?? 0}
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Late Bucket</th><th>Count</th><th>% of Late</th></tr></thead>
            <tbody>
              {histogram.map((row) => (
                <tr key={row.bucket}><td>{row.bucket}</td><td>{row.count}</td><td>{row.pct_late}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>ETA Error Histogram (Signed Minutes)</h3>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Bin</th><th>Count</th></tr></thead>
            <tbody>
              {etaBins.map((row) => (
                <tr key={row.label}><td>{row.label}</td><td>{row.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Promise Reliability Table</h3>
        <PromiseReliabilityTable rows={rows} />
      </section>
    </main>
  );
}
