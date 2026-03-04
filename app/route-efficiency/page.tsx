"use client";

import { useCallback, useEffect, useState } from "react";

import { AppNav } from "@/components/layout/nav";
import { DwellTrendChart } from "@/components/charts/dwell-trend";
import { RouteEfficiencyScatterChart } from "@/components/charts/route-efficiency-scatter";
import { RouteEfficiencyTable } from "@/components/tables/route-efficiency-table";
import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

type Row = {
  warehouse_code: string;
  day: string;
  city: string;
  total_orders: number;
  delivered_count: number;
  on_time_count: number;
  active_areas: number;
  parcels_per_active_area: number | null;
  avg_delivery_minutes: number | null;
  otd_pct: number | null;
};

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function RouteEfficiencyPage() {
  const [warehouse, setWarehouse] = useState("ALL");
  const [from, setFrom] = useState(dateOffset(-30));
  const [to, setTo] = useState(dateOffset(0));
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ warehouse, from, to });
    const res = await fetch(`/api/route-efficiency?${params.toString()}`);
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
      <header className="page-header"><h1>Route Efficiency</h1><p className="muted">Observe stop density proxies and operational efficiency trends.</p></header>
      <section className="card grid three">
        <label>Warehouse<select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}><option value="ALL">All Warehouses</option>{WAREHOUSE_CODES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <div className="btn-row" style={{ alignItems: "end" }}><button className="btn" type="button" onClick={() => void load()}>Apply</button></div>
      </section>
      <section className="card"><h3>Efficiency Scatter</h3><RouteEfficiencyScatterChart rows={rows} /></section>
      <section className="card"><h3>Delivery Minutes Trend</h3><DwellTrendChart rows={rows} /></section>
      <section className="card"><h3>Route Efficiency Table</h3><RouteEfficiencyTable rows={rows} /></section>
    </main>
  );
}


