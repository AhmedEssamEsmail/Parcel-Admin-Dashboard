"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import { formatDateMmmDd } from "@/lib/utils/date-format";

type PeriodChange = {
  total_placed: { value: number; pct: number };
  otd_pct: { value: number; direction: "up" | "down" };
  avg_delivery_minutes: { value: number; direction: "improved" | "worse" };
};

type PeriodRow = {
  warehouse_code: string;
  total_placed: number;
  total_delivered: number;
  on_time: number;
  late: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  week_start?: string;
  week_label?: string;
  month_start?: string;
  month_label?: string;
  changes: PeriodChange | null;
};

type WarehouseGroup = {
  warehouse_code: string;
  warehouse_name: string;
  periods: PeriodRow[];
};

type WowMomResponse = {
  period_type: "week" | "month";
  periods: PeriodRow[];
  groups?: WarehouseGroup[];
};

type CollapsedSummary = {
  total_placed: number | null;
  total_delivered: number | null;
  on_time: number | null;
  late: number | null;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
};

type WowMomTableProps = {
  warehouse: string;
  from: string;
  to: string;
  initialData?: WowMomResponse | null;
};

export function WowMomTable({ warehouse, from, to, initialData }: WowMomTableProps) {
  const [viewType, setViewType] = useState<"week" | "month">("week");
  const [data, setData] = useState<WowMomResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("wow-collapsed-groups-v1");
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    window.localStorage.setItem("wow-collapsed-groups-v1", JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  useEffect(() => {
    const load = async () => {
      if (!warehouse) return;
      setLoading(true);

      const params = new URLSearchParams({
        warehouse,
        periodType: viewType,
        limit: "6",
        from,
        to,
      });

      const res = await fetch(`/api/wow-summary?${params.toString()}`);
      const json = (await res.json()) as WowMomResponse;
      if (res.ok) {
        setData(json);
      }
      setLoading(false);
    };

    void load();
  }, [warehouse, viewType, from, to]);

  const isGroupedByWarehouse = useMemo(
    () => warehouse === "ALL" && (data?.groups?.length ?? 0) > 0,
    [warehouse, data?.groups],
  );
  const groupedWarehouseCodes = useMemo(
    () => (data?.groups ?? []).map((group) => group.warehouse_code),
    [data?.groups],
  );
  const allGroupsCollapsed = useMemo(
    () =>
      groupedWarehouseCodes.length > 0 &&
      groupedWarehouseCodes.every((code) => collapsedGroups[code] ?? false),
    [collapsedGroups, groupedWarehouseCodes],
  );

  const toggleAllGroups = () => {
    if (groupedWarehouseCodes.length === 0) return;
    const nextCollapsedState = !allGroupsCollapsed;
    setCollapsedGroups((current) => {
      const next = { ...current };
      groupedWarehouseCodes.forEach((code) => {
        next[code] = nextCollapsedState;
      });
      return next;
    });
  };

  if (!data?.periods && !data?.groups) return null;

  return (
    <div className="wow-mom-table">
      <div className="table-header">
        <div className="wow-header-title">
          {isGroupedByWarehouse && (
            <button className="btn-ghost wow-global-collapse-btn" type="button" onClick={toggleAllGroups}>
              {allGroupsCollapsed ? "Expand All" : "Collapse All"}
            </button>
          )}
          <h3>
            {viewType === "week" ? "Week-over-Week" : "Month-over-Month"} Performance
            <span className="including-wa">(Including WA Orders)</span>
          </h3>
        </div>
        <div className="toggle-switch">
          <button className={viewType === "week" ? "active" : ""} onClick={() => setViewType("week")}>
            Weekly View
          </button>
          <button className={viewType === "month" ? "active" : ""} onClick={() => setViewType("month")}>
            Monthly View
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading trends...</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{viewType === "week" ? "Week" : "Month"}</th>
                <th>Total Placed</th>
                <th>Delivered</th>
                <th>On-Time</th>
                <th>Late</th>
                <th>OTD %</th>
                <th>Avg Time</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {isGroupedByWarehouse
                ? (data.groups ?? []).map((group) => {
                    const isCollapsed = collapsedGroups[group.warehouse_code] ?? false;
                    const collapsedSummary = summarizePeriods(group.periods);

                    return (
                      <FragmentGroup key={group.warehouse_code}>
                        <tr className="warehouse-group-row">
                          <td className="period-label">
                            <button
                              className="warehouse-collapse-btn"
                              type="button"
                              onClick={() =>
                                setCollapsedGroups((current) => ({
                                  ...current,
                                  [group.warehouse_code]: !isCollapsed,
                                }))
                              }
                            >
                              <span className="warehouse-collapse-icon">{isCollapsed ? "+" : "-"}</span>
                              <strong>{group.warehouse_name}</strong>
                              <span className="warehouse-group-code">({group.warehouse_code})</span>
                            </button>
                            <div className="warehouse-group-inline-note">Selected Range Total</div>
                          </td>
                          <td>{formatCount(collapsedSummary.total_placed)}</td>
                          <td>{formatCount(collapsedSummary.total_delivered)}</td>
                          <td className="on-time">{formatCount(collapsedSummary.on_time)}</td>
                          <td className="late">{formatCount(collapsedSummary.late)}</td>
                          <td className={getOtdClass(collapsedSummary.otd_pct)}>
                            {formatPercent(collapsedSummary.otd_pct)}
                          </td>
                          <td>{formatTime(collapsedSummary.avg_delivery_minutes)}</td>
                          <td>-</td>
                        </tr>

                        {!isCollapsed &&
                          group.periods.map((period, idx) => (
                            <tr key={`${group.warehouse_code}-${period.week_start ?? period.month_start}-${idx}`}>
                              <td className="period-label">
                                {getPeriodLabel(period, viewType)}
                              </td>
                              <td>{period.total_placed}</td>
                              <td>{period.total_delivered}</td>
                              <td className="on-time">{period.on_time}</td>
                              <td className="late">{period.late}</td>
                              <td className={getOtdClass(period.otd_pct)}>
                                {period.otd_pct === null ? "-" : `${period.otd_pct.toFixed(1)}%`}
                              </td>
                              <td>{formatTime(period.avg_delivery_minutes)}</td>
                              <td className={getChangeClass(period.changes)}>
                                {period.changes ? (
                                  <span className="otd-change">
                                    {period.changes.otd_pct.direction === "up" ? "↑" : "↓"}
                                    {Math.abs(period.changes.otd_pct.value).toFixed(1)}%
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))}
                      </FragmentGroup>
                    );
                  })
                : (data.periods ?? []).map((period, idx) => (
                    <tr key={`${period.week_start ?? period.month_start}-${idx}`}>
                      <td className="period-label">
                        {getPeriodLabel(period, viewType)}
                      </td>
                      <td>{period.total_placed}</td>
                      <td>{period.total_delivered}</td>
                      <td className="on-time">{period.on_time}</td>
                      <td className="late">{period.late}</td>
                      <td className={getOtdClass(period.otd_pct)}>
                        {period.otd_pct === null ? "-" : `${period.otd_pct.toFixed(1)}%`}
                      </td>
                      <td>{formatTime(period.avg_delivery_minutes)}</td>
                      <td className={getChangeClass(period.changes)}>
                        {period.changes ? (
                          <span className="otd-change">
                            {period.changes.otd_pct.direction === "up" ? "↑" : "↓"}
                            {Math.abs(period.changes.otd_pct.value).toFixed(1)}%
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="btn-row">
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            setExporting(true);
            window.location.href = `/api/export/csv?type=wow&warehouse=${warehouse}&periodType=${viewType}&from=${from}&to=${to}`;
            setTimeout(() => setExporting(false), 1500);
          }}
          disabled={exporting}
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>
    </div>
  );
}

function FragmentGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function getOtdClass(otd: number | null): string {
  if (otd === null || otd === undefined) return "";
  if (otd >= 90) return "excellent";
  if (otd >= 80) return "good";
  return "needs-attention";
}

function getChangeClass(changes: PeriodChange | null): string {
  if (!changes) return "";
  return changes.otd_pct.direction === "up" ? "improved" : "declined";
}

function formatTime(minutes: number | null): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return String(Math.round(value));
}

function getPeriodLabel(period: PeriodRow, viewType: "week" | "month"): string {
  if (viewType === "week") {
    const candidate = period.week_start ?? period.week_label ?? "";
    return formatDateMmmDd(candidate);
  }

  const candidate = period.month_start ?? period.month_label ?? "";
  return formatMonthLabel(candidate);
}

function formatMonthLabel(value: string): string {
  const formatted = formatDateMmmDd(value);
  if (formatted === "-") return "-";
  return formatted.split("-")[0] ?? formatted;
}

function summarizePeriods(periods: PeriodRow[]): CollapsedSummary {
  if (periods.length === 0) {
    return {
      total_placed: null,
      total_delivered: null,
      on_time: null,
      late: null,
      otd_pct: null,
      avg_delivery_minutes: null,
    };
  }

  const otdValues = periods
    .map((period) => period.otd_pct)
    .filter((value): value is number => value !== null && value !== undefined);
  const avgTimeValues = periods
    .map((period) => period.avg_delivery_minutes)
    .filter((value): value is number => value !== null && value !== undefined);

  return {
    total_placed: periods.reduce((sum, period) => sum + period.total_placed, 0),
    total_delivered: periods.reduce((sum, period) => sum + period.total_delivered, 0),
    on_time: periods.reduce((sum, period) => sum + period.on_time, 0),
    late: periods.reduce((sum, period) => sum + period.late, 0),
    otd_pct:
      otdValues.length > 0
        ? otdValues.reduce((sum, value) => sum + value, 0) / otdValues.length
        : null,
    avg_delivery_minutes:
      avgTimeValues.length > 0
        ? avgTimeValues.reduce((sum, value) => sum + value, 0) / avgTimeValues.length
        : null,
  };
}
