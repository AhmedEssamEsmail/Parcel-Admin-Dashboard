"use client";

import { useCallback, useEffect, useState } from "react";

import { EtaErrorDistributionChart } from "@/components/charts/eta-error-distribution";
import { AppNav } from "@/components/layout/nav";
import { PromiseReliabilityTrendChart } from "@/components/charts/promise-reliability-trend";
import { PromiseReliabilityTable } from "@/components/tables/promise-reliability-table";
import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

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

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function PromiseReliabilityPage() {
  const [warehouse, setWarehouse] = useState("ALL");
  const [from, setFrom] = useState(dateOffset(-30));
  const [to, setTo] = useState(dateOffset(0));
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ warehouse, from, to });
    const res = await fetch(`/api/promise-reliability?${params.toString()}`);
    const payload = (await res.json()) as { rows?: Row[] };
    setRows(payload.rows ?? []);
  }, [warehouse, from, to]);

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
      <header className="page-header"><h1>Promise Reliability</h1><p className="muted">Track promise-window adherence and ETA error trends.</p></header>
      <section className="card grid three">
        <label>Warehouse<select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}><option value="ALL">All Warehouses</option>{WAREHOUSE_CODES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <div className="btn-row" style={{ alignItems: "end" }}><button className="btn" type="button" onClick={() => void load()}>Apply</button></div>
      </section>
      <section className="card"><h3>Promise Hit Rate Trend</h3><PromiseReliabilityTrendChart rows={rows} /></section>
      <section className="card"><h3>ETA Error Distribution</h3><EtaErrorDistributionChart rows={rows} /></section>
      <section className="card"><h3>Promise Reliability Table</h3><PromiseReliabilityTable rows={rows} /></section>
    </main>
  );
}


