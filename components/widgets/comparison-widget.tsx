"use client";

import { useState } from "react";
import { formatDateMmmDd } from "@/lib/utils/date-format";

type Props = {
  warehouse: string;
};

type PeriodStats = {
  start: string;
  end: string;
  total_placed: number;
  total_delivered: number;
  total_delivered_delivery_date: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
};

type PeriodDelta = {
  absolute: number;
  pct: number;
};

type CompareResponse = {
  period_a: PeriodStats;
  period_b: PeriodStats;
  comparison: {
    total_placed: PeriodDelta;
    total_delivered: PeriodDelta;
    total_delivered_delivery_date: PeriodDelta;
    otd_pct: { absolute: number; improved: boolean };
    avg_delivery_minutes: { absolute: number; improved: boolean };
  };
  error?: string;
};

export function ComparisonWidget({ warehouse }: Props) {
  const [periodAStart, setPeriodAStart] = useState(shiftDate(-30));
  const [periodAEnd, setPeriodAEnd] = useState(shiftDate(-16));
  const [periodBStart, setPeriodBStart] = useState(shiftDate(-15));
  const [periodBEnd, setPeriodBEnd] = useState(shiftDate(0));
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = async () => {
    if (!warehouse) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/compare-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse,
          period_a_start: periodAStart,
          period_a_end: periodAEnd,
          period_b_start: periodBStart,
          period_b_end: periodBEnd,
        }),
      });

      const payload = (await response.json()) as CompareResponse;
      if (!response.ok) {
        setError(payload.error ?? "Failed to compare periods.");
        return;
      }
      setData(payload);
    } catch {
      setError("Network error while comparing periods.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="comparison-widget">
      <h3>Compare Periods</h3>
      <div className="grid three">
        <label>
          Period A Start
          <input type="date" value={periodAStart} onChange={(e) => setPeriodAStart(e.target.value)} />
        </label>
        <label>
          Period A End
          <input type="date" value={periodAEnd} onChange={(e) => setPeriodAEnd(e.target.value)} />
        </label>
        <label>
          Period B Start
          <input type="date" value={periodBStart} onChange={(e) => setPeriodBStart(e.target.value)} />
        </label>
        <label>
          Period B End
          <input type="date" value={periodBEnd} onChange={(e) => setPeriodBEnd(e.target.value)} />
        </label>
        <div className="btn-row" style={{ alignItems: "end" }}>
          <button className="btn" onClick={() => void compare()} disabled={loading}>
            {loading ? "Comparing..." : "Compare"}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {data && (
        <div className="comparison-results">
          <div className="comparison-cards">
            <div className="card">
              <h4>Period A</h4>
              <p className="muted">
                {formatDateMmmDd(data.period_a.start)} to {formatDateMmmDd(data.period_a.end)}
              </p>
              <p>Placed: {data.period_a.total_placed}</p>
              <p>Delivered (Order Date): {data.period_a.total_delivered}</p>
              <p>Delivered (Delivery Date): {data.period_a.total_delivered_delivery_date}</p>
              <p>OTD%: {data.period_a.otd_pct?.toFixed(1) ?? "-"}%</p>
              <p>Avg Time: {formatTime(data.period_a.avg_delivery_minutes)}</p>
            </div>
            <div className="card">
              <h4>Period B</h4>
              <p className="muted">
                {formatDateMmmDd(data.period_b.start)} to {formatDateMmmDd(data.period_b.end)}
              </p>
              <p>Placed: {data.period_b.total_placed}</p>
              <p>Delivered (Order Date): {data.period_b.total_delivered}</p>
              <p>Delivered (Delivery Date): {data.period_b.total_delivered_delivery_date}</p>
              <p>OTD%: {data.period_b.otd_pct?.toFixed(1) ?? "-"}%</p>
              <p>Avg Time: {formatTime(data.period_b.avg_delivery_minutes)}</p>
            </div>
            <div className="card comparison-diff comparison-diff-card">
              <h4>Change (B vs A)</h4>
              <p>
                Placed: {formatDiff(data.comparison.total_placed)}
              </p>
              <p>
                Delivered (Order Date): {formatDiff(data.comparison.total_delivered)}
              </p>
              <p>
                Delivered (Delivery Date): {formatDiff(data.comparison.total_delivered_delivery_date)}
              </p>
              <p className={data.comparison.otd_pct.improved ? "improved" : "declined"}>
                OTD%: {formatDelta(data.comparison.otd_pct.absolute, "%")}
              </p>
              <p className={data.comparison.avg_delivery_minutes.improved ? "improved" : "declined"}>
                Avg Time: {formatDelta(data.comparison.avg_delivery_minutes.absolute, "m")}
              </p>
            </div>
          </div>
          <div className="btn-row">
            <a
              className="btn btn-ghost"
              href={`/api/export/csv?type=comparison&warehouse=${warehouse}&from=${periodAStart}&to=${periodBEnd}`}
            >
              Export Comparison CSV
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function shiftDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatTime(minutes: number | null): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function formatDiff(diff: { absolute: number; pct: number }): string {
  const sign = diff.absolute >= 0 ? "↑" : "↓";
  return `${sign} ${Math.abs(diff.absolute)} (${diff.pct}%)`;
}

function formatDelta(value: number, suffix: string): string {
  const sign = value >= 0 ? "↑" : "↓";
  return `${sign} ${Math.abs(value).toFixed(1)}${suffix}`;
}
