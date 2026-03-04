"use client";

import { useCallback, useEffect, useState } from "react";

import { AppNav } from "@/components/layout/nav";

type Issue = {
  id: string;
  check_name: string;
  description: string;
  severity: string;
  affected_count: number;
  warehouse_code?: string;
  recommendation?: string;
  sample_records?: string[];
};

type DataQualityResponse = {
  summary: { critical_count: number; warning_count: number; info_count: number };
  issues: { critical: Issue[]; warning: Issue[]; info: Issue[] };
};

export default function DataQualityPage() {
  const [data, setData] = useState<DataQualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/data-quality");
    const json = (await res.json()) as DataQualityResponse;
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 0);
    const interval = setInterval(() => {
      void load();
    }, 5 * 60 * 1000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [load]);

  const resolveIssue = async (issueId: string) => {
    await fetch("/api/data-quality", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue_id: issueId, resolved_by: "admin" }),
    });
    void load();
  };

  return (
    <main className="page-wrap">
      <AppNav />

      <header className="page-header">
        <h1>Data Quality Monitor</h1>
        <p className="muted">Last updated: {new Date().toLocaleString()}</p>
      </header>

      <section className="grid three">
        <div className="card summary-card critical">
          <h2>{data?.summary.critical_count ?? 0}</h2>
          <p>Critical Issues</p>
        </div>
        <div className="card summary-card warning">
          <h2>{data?.summary.warning_count ?? 0}</h2>
          <p>Warnings</p>
        </div>
        <div className="card summary-card info">
          <h2>{data?.summary.info_count ?? 0}</h2>
          <p>Info</p>
        </div>
      </section>

      {data?.issues.critical.length ? (
        <section className="card">
          <h3>🔴 Critical Issues</h3>
          {data.issues.critical.map((issue) => (
            <div key={issue.id} className="issue-card critical">
              <div className="issue-header">
                <strong>{issue.check_name}</strong>
                <span className="count">{issue.affected_count} records</span>
              </div>
              <p>{issue.description}</p>
              {issue.recommendation && <p className="recommendation">💡 {issue.recommendation}</p>}
              <div className="issue-actions">
                <button onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}>
                  {expandedIssue === issue.id ? "Hide Records" : "View Records"}
                </button>
                <button className="secondary" onClick={() => exportIssue(issue.id)}>
                  Export List
                </button>
                <button className="resolve" onClick={() => void resolveIssue(issue.id)}>
                  Mark Resolved
                </button>
              </div>
              {expandedIssue === issue.id && (
                <div className="sample-records">
                  <h4>Sample Parcel IDs:</h4>
                  <code>{issue.sample_records?.slice(0, 10).join(", ")}</code>
                </div>
              )}
            </div>
          ))}
        </section>
      ) : null}

      {data?.issues.warning.length ? (
        <section className="card">
          <h3>⚠️ Warnings</h3>
          {data.issues.warning.map((issue) => (
            <div key={issue.id} className="issue-card warning">
              <div className="issue-header">
                <strong>{issue.check_name}</strong>
                <span className="warehouse">{issue.warehouse_code}</span>
                <span className="count">{issue.affected_count} records</span>
              </div>
              <p>{issue.description}</p>
              {issue.recommendation && <p className="recommendation">💡 {issue.recommendation}</p>}
              <div className="issue-actions">
                <button onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}>
                  {expandedIssue === issue.id ? "Hide Records" : "View Records"}
                </button>
                <button className="secondary" onClick={() => exportIssue(issue.id)}>
                  Export List
                </button>
                <button className="resolve" onClick={() => void resolveIssue(issue.id)}>
                  Mark Resolved
                </button>
              </div>
              {expandedIssue === issue.id && (
                <div className="sample-records">
                  <h4>Sample Parcel IDs:</h4>
                  <code>{issue.sample_records?.slice(0, 10).join(", ")}</code>
                </div>
              )}
            </div>
          ))}
        </section>
      ) : null}

      {data?.issues.info.length ? (
        <section className="card">
          <h3>ℹ️ Information</h3>
          {data.issues.info.map((issue) => (
            <div key={issue.id} className="issue-card info">
              <div className="issue-header">
                <strong>{issue.check_name}</strong>
                <span className="count">{issue.affected_count}</span>
              </div>
              <p>{issue.description}</p>
              <div className="issue-actions">
                <button onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}>
                  {expandedIssue === issue.id ? "Hide Records" : "View Records"}
                </button>
                <button className="secondary" onClick={() => exportIssue(issue.id)}>
                  Export List
                </button>
                <button className="resolve" onClick={() => void resolveIssue(issue.id)}>
                  Mark Resolved
                </button>
              </div>
              {expandedIssue === issue.id && (
                <div className="sample-records">
                  <h4>Sample Parcel IDs:</h4>
                  <code>{issue.sample_records?.slice(0, 10).join(", ")}</code>
                </div>
              )}
            </div>
          ))}
        </section>
      ) : null}

      {loading && <div className="loading-overlay">Refreshing...</div>}
    </main>
  );
}

function exportIssue(issueId: string) {
  const link = document.createElement("a");
  link.href = `/api/data-quality?issue_id=${issueId}`;
  link.click();
}