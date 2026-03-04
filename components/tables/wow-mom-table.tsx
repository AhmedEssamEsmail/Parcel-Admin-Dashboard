"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

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

type WowMomTableProps = {
  warehouse: string;
  initialData?: WowMomResponse | null;
};

export function WowMomTable({ warehouse, initialData }: WowMomTableProps) {
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
      const res = await fetch(`/api/wow-summary?warehouse=${warehouse}&periodType=${viewType}&limit=6`);
      const json = (await res.json()) as WowMomResponse;
      setData(json);
      setLoading(false);
    };

    void load();
  }, [warehouse, viewType]);

  const isGroupedByWarehouse = useMemo(
    () => warehouse === "ALL" && (data?.groups?.length ?? 0) > 0,
    [warehouse, data?.groups],
  );

  if (!data?.periods && !data?.groups) return null;

  return (
    <div className="wow-mom-table">
      <div className="table-header">
        <h3>
          {viewType === "week" ? "Week-over-Week" : "Month-over-Month"} Performance
          <span className="including-wa">(Including WA Orders)</span>
        </h3>
        <div className="toggle-switch">
          <button
            className={viewType === "week" ? "active" : ""}
            onClick={() => setViewType("week")}
          >
            Weekly View
          </button>
          <button
            className={viewType === "month" ? "active" : ""}
            onClick={() => setViewType("month")}
          >
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

                    return (
                      <FragmentGroup key={group.warehouse_code}>
                        <tr className="warehouse-group-row">
                          <td colSpan={8}>
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
                              <span>{isCollapsed ? "▶" : "▼"}</span>
                              <strong>{group.warehouse_name}</strong>
                              <span className="warehouse-group-code">({group.warehouse_code})</span>
                            </button>
                          </td>
                        </tr>

                        {!isCollapsed &&
                          group.periods.map((period, idx) => (
                            <tr key={`${group.warehouse_code}-${period.week_start ?? period.month_start}-${idx}`}>
                              <td className="period-label">
                                {viewType === "week" ? period.week_label : period.month_label}
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
                        {viewType === "week" ? period.week_label : period.month_label}
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
            window.location.href = `/api/export/csv?type=wow&warehouse=${warehouse}&periodType=${viewType}`;
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
  if (!otd) return "";
  if (otd >= 90) return "excellent";
  if (otd >= 80) return "good";
  return "needs-attention";
}

function getChangeClass(changes: PeriodChange | null): string {
  if (!changes) return "";
  return changes.otd_pct.direction === "up" ? "improved" : "declined";
}

function formatTime(minutes: number | null): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}
