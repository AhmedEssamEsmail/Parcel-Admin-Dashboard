"use client";

import { useCallback, useEffect, useState } from "react";

import { ExceptionsTrendChart } from "@/components/charts/exceptions-trend";
import { AppNav } from "@/components/layout/nav";
import { ExceptionsTable } from "@/components/tables/exceptions-table";
import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

type ExceptionRow = {
  id: string;
  warehouse_code: string;
  parcel_id: number | null;
  exception_type: string;
  severity: string;
  status: string;
  description: string;
  detected_at: string;
  aging_hours: number;
};

type TrendRow = { day: string; severity: string; open_count: number };

type ApiResponse = { rows: ExceptionRow[]; trend: TrendRow[]; error?: string };

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function ExceptionsPage() {
  const [warehouse, setWarehouse] = useState("ALL");
  const [from, setFrom] = useState(dateOffset(-14));
  const [to, setTo] = useState(dateOffset(0));
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("open");
  const [data, setData] = useState<ApiResponse>({ rows: [], trend: [] });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ warehouse, from, to, severity, status });
    const response = await fetch(`/api/exceptions?${params.toString()}`);
    const payload = (await response.json()) as ApiResponse;
    setData(response.ok ? payload : { rows: [], trend: [], error: payload.error });
    setLoading(false);
  }, [warehouse, from, to, severity, status]);

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

  const updateStatus = async (id: string, nextStatus: "acknowledged" | "resolved") => {
    await fetch("/api/exceptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exception_id: id, status: nextStatus, actor: "admin" }),
    });
    await load();
  };

  return (
    <main className="page-wrap">
      <AppNav />
      <header className="page-header">
        <h1>Exceptions Control Tower</h1>
        <p className="muted">Monitor and resolve delivery exceptions quickly.</p>
      </header>

      <section className="card grid three">
        <label>Warehouse
          <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            <option value="ALL">All Warehouses</option>
            {WAREHOUSE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label>Severity
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">All</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option>
          </select>
        </label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option>
          </select>
        </label>
        <div className="btn-row" style={{ alignItems: "end" }}>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading..." : "Apply"}</button>
        </div>
      </section>

      <section className="card">
        <h3>Open Exceptions Trend</h3>
        <ExceptionsTrendChart rows={data.trend} />
      </section>

      <section className="card">
        <h3>Exceptions</h3>
        <ExceptionsTable rows={data.rows} onUpdate={updateStatus} />
      </section>
    </main>
  );
}


