"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OnTimeComboChart } from "@/components/charts/on-time-combo";
import { GlobalFilters } from "@/components/filters/global-filters";
import { AppNav } from "@/components/layout/nav";
import { DodSummaryTable } from "@/components/tables/dod-summary-table";
import { WowMomTable } from "@/components/tables/wow-mom-table";
import { ComparisonWidget } from "@/components/widgets/comparison-widget";
import { Leaderboard } from "@/components/widgets/leaderboard";
import { useGlobalFilters } from "@/lib/filters/useGlobalFilters";

type DodRow = {
  day: string;
  total_placed: number;
  total_delivered: number;
  on_time: number;
  late: number;
  otd_pct: number | null;
};

type DodResponse = {
  rows_inc_wa: DodRow[];
  rows_exc_wa: DodRow[];
  wa_count: number;
  null_on_time_count: number;
  series: {
    labels: string[];
    totalOrders: number[];
    onTimePct: number[];
    waDeliveredPct: number[];
  };
};

type AvgDeliveryResponse = {
  overall: { avg_minutes: number | null };
  trend: { direction: "increasing" | "decreasing" | "stable"; change_minutes: number };
};

const AUTO_REFRESH_INTERVAL = 2 * 60 * 60 * 1000;

export default function DashboardPage() {
  const { filters, setFilters, appliedFilters, applyFilters } = useGlobalFilters({
    warehouse: "ALL",
    fromOffsetDays: -45,
  });
  const [data, setData] = useState<DodResponse | null>(null);
  const [avgDelivery, setAvgDelivery] = useState<AvgDeliveryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [exporting, setExporting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams(appliedFilters);
      const [dodResponse, avgResponse] = await Promise.all([
        fetch(`/api/dod?${params.toString()}`),
        fetch(`/api/avg-delivery?${params.toString()}`),
      ]);
      const payload = (await dodResponse.json()) as DodResponse & { error?: string };
      const avgPayload = (await avgResponse.json()) as AvgDeliveryResponse & { error?: string };

      if (!dodResponse.ok) {
        setError(payload.error ?? "Failed to load dashboard data.");
        return;
      }

      setData(payload.rows_inc_wa ? payload : null);
      setAvgDelivery(avgResponse.ok ? avgPayload : null);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch {
      setError("Network error while loading dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const secondsInterval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);

    intervalRef.current = setInterval(() => {
      if (!loading) {
        void load();
      }
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      clearInterval(secondsInterval);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [lastUpdated, loading, load]);

  const chartData = useMemo(
    () => ({
      labels: data?.series.labels ?? [],
      totals: data?.series.totalOrders ?? [],
      onTimePct: data?.series.onTimePct ?? [],
      waDeliveredPct: data?.series.waDeliveredPct ?? [],
    }),
    [data],
  );

  return (
    <main className="page-wrap">
      <AppNav />

      <div className="refresh-bar">
        <div className="refresh-info">
          <span>Last updated: {formatElapsed(secondsAgo)} ago</span>
          <span
            className="refresh-help-tooltip"
            title="Data refreshes automatically every 2 hours."
            aria-label="Data refreshes automatically every 2 hours."
          >
            i
          </span>
        </div>
        <button onClick={() => void load()} disabled={loading}>
          Refresh Now
        </button>
      </div>

      <GlobalFilters
        filters={filters}
        onChange={setFilters}
        onApply={() => applyFilters()}
        loading={loading}
        trailing={
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setExporting(true);
              window.location.href = `/api/export/csv?type=dashboard&warehouse=${appliedFilters.warehouse}&from=${appliedFilters.from}&to=${appliedFilters.to}`;
              setTimeout(() => setExporting(false), 1500);
            }}
            disabled={exporting}
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        }
      />

      {error && <p className="error">{error}</p>}

      {avgDelivery && (
        <section className="card avg-delivery-widget">
          <h3>Average Delivery Time</h3>
          <div className="avg-stat">
            <span className="big-number">{formatTime(avgDelivery.overall.avg_minutes)}</span>
            <span className={`trend ${avgDelivery.trend.direction}`}>
              {avgDelivery.trend.direction === "increasing"
                ? "up"
                : avgDelivery.trend.direction === "decreasing"
                  ? "down"
                  : "flat"}
              {Math.abs(avgDelivery.trend.change_minutes)}m vs last week
            </span>
          </div>
        </section>
      )}

      <section className="card">
        <WowMomTable
          warehouse={appliedFilters.warehouse}
          from={appliedFilters.from}
          to={appliedFilters.to}
        />
      </section>

      <section className="card">
        <ComparisonWidget
          warehouse={appliedFilters.warehouse === "ALL" ? "KUWAIT" : appliedFilters.warehouse}
        />
      </section>

      <section className="card">
        <Leaderboard />
      </section>

      <section className="card">
        <OnTimeComboChart
          labels={chartData.labels}
          totals={chartData.totals}
          onTimePct={chartData.onTimePct}
          waDeliveredPct={chartData.waDeliveredPct}
        />
      </section>

      <section className="card">
        <h3>On-Time Delivery - Including Waiting Address Orders</h3>
        <p
          className="subtitle"
          title="OTD% = On-Time Delivered / Total Delivered. WA Delivered % = WA Delivered / Total Delivered."
        >
          Total WA Orders: {data?.wa_count ?? 0}
        </p>
        <DodSummaryTable rows={data?.rows_inc_wa ?? []} />
      </section>

      <section className="card">
        <h3>On-Time Delivery - Excluding Waiting Address Orders</h3>
        <DodSummaryTable rows={data?.rows_exc_wa ?? []} />
      </section>
    </main>
  );
}

function formatTime(minutes: number | null): string {
  if (!minutes) return "-:--";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function formatElapsed(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
