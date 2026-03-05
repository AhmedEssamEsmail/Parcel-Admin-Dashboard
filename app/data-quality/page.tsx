"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GlobalFilters } from "@/components/filters/global-filters";
import { AppNav } from "@/components/layout/nav";
import { useGlobalFilters } from "@/lib/filters/useGlobalFilters";
import { buildParcelDetailHref } from "@/lib/navigation/links";

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
  const { filters, setFilters, appliedFilters, applyFilters } = useGlobalFilters({
    warehouse: "ALL",
    fromOffsetDays: -30,
  });

  const [data, setData] = useState<DataQualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [resolutionFilter, setResolutionFilter] = useState("open");
  const [checkIdFilter, setCheckIdFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams(appliedFilters);
    if (severityFilter !== "all") params.set("severity", severityFilter);
    if (resolutionFilter) params.set("resolution", resolutionFilter);
    if (checkIdFilter.trim()) params.set("check_id", checkIdFilter.trim());
    const res = await fetch(`/api/data-quality?${params.toString()}`);
    const json = (await res.json()) as DataQualityResponse;
    setData(json);
    setLoading(false);
  }, [appliedFilters, severityFilter, resolutionFilter, checkIdFilter]);

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

      <GlobalFilters filters={filters} onChange={setFilters} onApply={() => applyFilters()} />

      <section className="card grid three">
        <label>
          Severity
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label>
          Resolution
          <select value={resolutionFilter} onChange={(event) => setResolutionFilter(event.target.value)}>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          Check ID
          <input value={checkIdFilter} onChange={(event) => setCheckIdFilter(event.target.value)} />
        </label>
      </section>

      <section className="grid three">
        <div className="card summary-card critical"><h2>{data?.summary.critical_count ?? 0}</h2><p>Critical Issues</p></div>
        <div className="card summary-card warning"><h2>{data?.summary.warning_count ?? 0}</h2><p>Warnings</p></div>
        <div className="card summary-card info"><h2>{data?.summary.info_count ?? 0}</h2><p>Info</p></div>
      </section>

      {renderIssueList("Critical Issues", "critical", data?.issues.critical ?? [], expandedIssue, setExpandedIssue, resolveIssue)}
      {renderIssueList("Warnings", "warning", data?.issues.warning ?? [], expandedIssue, setExpandedIssue, resolveIssue)}
      {renderIssueList("Information", "info", data?.issues.info ?? [], expandedIssue, setExpandedIssue, resolveIssue)}

      {loading && <div className="loading-overlay">Refreshing...</div>}
    </main>
  );
}

function renderIssueList(
  title: string,
  tone: "critical" | "warning" | "info",
  issues: Issue[],
  expandedIssue: string | null,
  setExpandedIssue: (id: string | null) => void,
  resolveIssue: (id: string) => Promise<void>,
) {
  if (issues.length === 0) return null;

  return (
    <section className="card">
      <h3>{title}</h3>
      {issues.map((issue) => (
        <div key={issue.id} className={`issue-card ${tone}`}>
          <div className="issue-header">
            <strong>{issue.check_name}</strong>
            <span className="count">{issue.affected_count} records</span>
          </div>
          <p>{issue.description}</p>
          {issue.recommendation && <p className="recommendation">{issue.recommendation}</p>}
          <div className="issue-actions">
            <button onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}>
              {expandedIssue === issue.id ? "Hide Records" : "View Records"}
            </button>
            <button className="secondary" onClick={() => exportIssue(issue.id)}>Export List</button>
            <button className="resolve" onClick={() => void resolveIssue(issue.id)}>Mark Resolved</button>
          </div>
          {expandedIssue === issue.id && (
            <div className="sample-records">
              <h4>Sample Parcel IDs:</h4>
              <div className="btn-row">
                {(issue.sample_records ?? []).slice(0, 10).map((record) => {
                  const href = buildParcelDetailHref(issue.warehouse_code ?? "", record);
                  return href ? (
                    <Link key={record} href={href}>{record}</Link>
                  ) : (
                    <span key={record}>{record}</span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function exportIssue(issueId: string) {
  const link = document.createElement("a");
  link.href = `/api/data-quality?issue_id=${issueId}`;
  link.click();
}
