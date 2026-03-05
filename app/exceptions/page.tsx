"use client";

import { useCallback, useEffect, useState } from "react";

import { ExceptionsTrendChart } from "@/components/charts/exceptions-trend";
import { GlobalFilters } from "@/components/filters/global-filters";
import { AppNav } from "@/components/layout/nav";
import { ExceptionsTable } from "@/components/tables/exceptions-table";
import { useGlobalFilters } from "@/lib/filters/useGlobalFilters";

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
  assignee?: string | null;
  category?: string | null;
  due_at?: string | null;
  resolution?: string | null;
  notes?: string | null;
};

type TrendRow = { day: string; severity: string; open_count: number };

type ApiResponse = { rows: ExceptionRow[]; trend: TrendRow[]; error?: string };

type MetricsResponse = {
  mtta_hours: number | null;
  mttr_hours: number | null;
  aging_buckets: Array<{ bucket: string; count: number }>;
};

export default function ExceptionsPage() {
  const { filters, setFilters, appliedFilters, applyFilters } = useGlobalFilters(
    {
      warehouse: "ALL",
      fromOffsetDays: -14,
    },
    ["severity", "status"],
  );

  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("open");
  const [data, setData] = useState<ApiResponse>({ rows: [], trend: [] });
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkDueAt, setBulkDueAt] = useState("");
  const [bulkResolution, setBulkResolution] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ ...appliedFilters, severity, status });
    const [exceptionsRes, metricsRes] = await Promise.all([
      fetch(`/api/exceptions?${params.toString()}`),
      fetch(`/api/exceptions/metrics?${params.toString()}`),
    ]);

    const payload = (await exceptionsRes.json()) as ApiResponse;
    const metricsPayload = (await metricsRes.json()) as MetricsResponse;

    setData(exceptionsRes.ok ? payload : { rows: [], trend: [], error: payload.error });
    setMetrics(metricsRes.ok ? metricsPayload : null);
    setLoading(false);
  }, [appliedFilters, severity, status]);

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

  const runBulkUpdate = async (nextStatus?: "acknowledged" | "resolved") => {
    if (selectedIds.length === 0) return;

    await fetch("/api/exceptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exception_ids: selectedIds,
        status: nextStatus,
        assignee: bulkAssignee || null,
        category: bulkCategory || null,
        due_at: bulkDueAt ? `${bulkDueAt}T23:59:59.000Z` : null,
        resolution: bulkResolution || null,
        notes: bulkNotes || null,
        actor: "admin",
      }),
    });

    setSelectedIds([]);
    await load();
  };

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id),
    );
  };

  return (
    <main className="page-wrap">
      <AppNav />
      <header className="page-header">
        <h1>Exceptions Control Tower</h1>
        <p className="muted">Monitor and resolve delivery exceptions quickly.</p>
      </header>

      <GlobalFilters
        filters={filters}
        onChange={setFilters}
        onApply={() => applyFilters()}
        loading={loading}
      />

      <section className="card grid three">
        <label>
          Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="all">All</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option>
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option>
          </select>
        </label>
        <div className="btn-row" style={{ alignItems: "end" }}>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading..." : "Apply"}</button>
        </div>
      </section>

      <section className="grid three">
        <div className="card summary-card"><h2>{metrics?.mtta_hours ?? "-"}</h2><p>MTTA (hours)</p></div>
        <div className="card summary-card"><h2>{metrics?.mttr_hours ?? "-"}</h2><p>MTTR (hours)</p></div>
        <div className="card summary-card"><h2>{selectedIds.length}</h2><p>Selected</p></div>
      </section>

      <section className="card">
        <h3>Aging Buckets</h3>
        <div className="table-scroll">
          <table className="data-table"><thead><tr><th>Bucket</th><th>Count</th></tr></thead><tbody>
            {(metrics?.aging_buckets ?? []).map((row) => <tr key={row.bucket}><td>{row.bucket}</td><td>{row.count}</td></tr>)}
          </tbody></table>
        </div>
      </section>

      <section className="card">
        <h3>Bulk Actions + Details</h3>
        <div className="grid three">
          <label>Assignee<input value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)} /></label>
          <label>Category<input value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} /></label>
          <label>Due Date<input type="date" value={bulkDueAt} onChange={(e) => setBulkDueAt(e.target.value)} /></label>
          <label>Resolution<input value={bulkResolution} onChange={(e) => setBulkResolution(e.target.value)} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Notes<input value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} /></label>
        </div>
        <div className="btn-row">
          <button className="btn-ghost" type="button" onClick={() => void runBulkUpdate("acknowledged")} disabled={selectedIds.length === 0}>Bulk Ack</button>
          <button className="btn" type="button" onClick={() => void runBulkUpdate("resolved")} disabled={selectedIds.length === 0}>Bulk Resolve</button>
          <button className="btn-ghost" type="button" onClick={() => void runBulkUpdate()} disabled={selectedIds.length === 0}>Update Details</button>
        </div>
      </section>

      <section className="card">
        <h3>Open Exceptions Trend</h3>
        <ExceptionsTrendChart rows={data.trend} />
      </section>

      <section className="card">
        <h3>Exceptions</h3>
        <ExceptionsTable rows={data.rows} selectedIds={selectedIds} onToggle={toggleSelection} onUpdate={updateStatus} />
      </section>
    </main>
  );
}
