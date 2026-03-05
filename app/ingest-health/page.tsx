"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GlobalFilters } from "@/components/filters/global-filters";
import { AppNav } from "@/components/layout/nav";
import { useGlobalFilters } from "@/lib/filters/useGlobalFilters";

type FreshnessRow = {
  warehouse_code: string;
  dataset_type: string;
  status: string;
  age_hours: number | null;
  last_run_at: string | null;
};

type IngestHealthResponse = {
  summary: { total_runs: number; warning_runs: number; failed_runs: number };
  recent_runs: Array<Record<string, unknown>>;
  freshness?: { stale_threshold_hours: number; matrix: FreshnessRow[] };
};

export default function IngestHealthPage() {
  const { filters, setFilters, appliedFilters, applyFilters } = useGlobalFilters({
    warehouse: "ALL",
    fromOffsetDays: -7,
  });

  const [data, setData] = useState<IngestHealthResponse | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ warehouse: appliedFilters.warehouse, days: "14" });
    const res = await fetch(`/api/ingest-health?${params.toString()}`);
    const payload = (await res.json()) as IngestHealthResponse;
    setData(payload);
  }, [appliedFilters.warehouse]);

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
        <h1>Ingest Health</h1>
        <p className="muted">Dataset freshness matrix and recent ingestion failures.</p>
      </header>

      <GlobalFilters filters={filters} onChange={setFilters} onApply={() => applyFilters()} />

      <section className="grid three">
        <div className="card summary-card"><h2>{data?.summary.total_runs ?? 0}</h2><p>Total Runs</p></div>
        <div className="card summary-card warning"><h2>{data?.summary.warning_runs ?? 0}</h2><p>Warnings</p></div>
        <div className="card summary-card critical"><h2>{data?.summary.failed_runs ?? 0}</h2><p>Failed</p></div>
      </section>

      <section className="card">
        <h3>Freshness Matrix</h3>
        <p className="muted">Stale threshold: {data?.freshness?.stale_threshold_hours ?? 24} hours</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Warehouse</th><th>Dataset</th><th>Status</th><th>Age (h)</th><th>Last Run</th></tr></thead>
            <tbody>
              {(data?.freshness?.matrix ?? []).map((row) => (
                <tr key={`${row.warehouse_code}-${row.dataset_type}`}>
                  <td>{row.warehouse_code}</td>
                  <td>{row.dataset_type}</td>
                  <td>{row.status}</td>
                  <td>{row.age_hours ?? "-"}</td>
                  <td>{row.last_run_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Recent Failures</h3>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Warehouse</th><th>Dataset</th><th>Status</th><th>Started</th><th>Error</th></tr></thead>
            <tbody>
              {(data?.recent_runs ?? [])
                .filter((row) => row.status === "failed")
                .slice(0, 20)
                .map((row, index) => (
                  <tr key={index}>
                    <td>{String(row.warehouse_code ?? "-")}</td>
                    <td>{String(row.dataset_type ?? "-")}</td>
                    <td>{String(row.status ?? "-")}</td>
                    <td>{String(row.started_at ?? "-")}</td>
                    <td>{String(row.error_message ?? "-")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Related Actions</h3>
        <div className="btn-row">
          <Link href="/settings/upload">Go to Upload</Link>
          <Link href="/data-quality">Data Quality</Link>
        </div>
      </section>
    </main>
  );
}


