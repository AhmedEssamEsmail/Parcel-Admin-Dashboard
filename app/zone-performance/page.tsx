"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppNav } from "@/components/layout/nav";
import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

type ZoneRow = {
  zone: string;
  total_orders: number;
  delivered_count: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  volume_status: string;
};

type ZoneDetailRow = ZoneRow & {
  city: string;
  area: string | null;
  on_time_count: number;
};

type ZoneResponse = {
  top?: ZoneRow[];
  bottom?: ZoneRow[];
  all?: ZoneDetailRow[];
};

export default function ZonePerformancePage() {
  const [warehouse, setWarehouse] = useState<string>("KUWAIT");
  const [from, setFrom] = useState<string>(dateOffset(-30));
  const [to, setTo] = useState<string>(dateOffset(0));
  const [data, setData] = useState<ZoneResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ warehouse, from, to, view: "all" });
    const res = await fetch(`/api/zone-performance?${params}`);
    const json = (await res.json()) as ZoneResponse;
    setData(json);
    setLoading(false);
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

  const handleExport = () => {
    setExporting(true);
    window.location.href = `/api/export/csv?type=zone&warehouse=${warehouse}&from=${from}&to=${to}`;
    setTimeout(() => setExporting(false), 1500);
  };

  const drilldown = useMemo(() => {
    const rows = data?.all ?? [];
    const zoneSummary = aggregateZones(rows, (row) => row.zone);
    const zoneList = zoneSummary.sort((a, b) => (b.otd_pct ?? 0) - (a.otd_pct ?? 0));

    const selectedZoneRows = selectedZone
      ? rows.filter((row) => row.zone === selectedZone)
      : [];
    const citySummary = aggregateZones(selectedZoneRows, (row) => row.city);

    const selectedCityRows = selectedCity
      ? selectedZoneRows.filter((row) => row.city === selectedCity)
      : [];
    const areaSummary = aggregateZones(selectedCityRows, (row) => row.area ?? "Unknown");

    return {
      zones: zoneList,
      cities: citySummary,
      areas: areaSummary,
    };
  }, [data, selectedZone, selectedCity]);

  return (
    <main className="page-wrap">
      <AppNav />

      <header className="page-header">
        <h1>Zone Performance</h1>
        <p className="muted">Analyze delivery performance by geographic zone.</p>
      </header>

      <section className="card grid three">
        <label>
          Warehouse
          <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            {WAREHOUSE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </section>

      {loading ? (
        <div className="card">Loading...</div>
      ) : (
        <>
          <section className="card">
            <h3>🏆 Top Performing Zones</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Orders</th>
                    <th>Delivered</th>
                    <th>On-Time %</th>
                    <th>Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.top?.map((zone, index) => (
                    <tr
                      key={zone.zone}
                      className="good"
                      onClick={() => {
                        setSelectedZone(zone.zone);
                        setSelectedCity(null);
                      }}
                    >
                      <td>
                        {index === 0 && "🥇 "}
                        {index === 1 && "🥈 "}
                        {index === 2 && "🥉 "}
                        {zone.zone}
                      </td>
                      <td>{zone.total_orders}</td>
                      <td>{zone.delivered_count}</td>
                      <td>{zone.otd_pct?.toFixed(1) ?? "-"}%</td>
                      <td>{formatTime(zone.avg_delivery_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h3>⚠️ Needs Attention</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Orders</th>
                    <th>Delivered</th>
                    <th>On-Time %</th>
                    <th>Avg Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.bottom?.map((zone) => (
                    <tr
                      key={zone.zone}
                      className="warning"
                      onClick={() => {
                        setSelectedZone(zone.zone);
                        setSelectedCity(null);
                      }}
                    >
                      <td>{zone.zone}</td>
                      <td>{zone.total_orders}</td>
                      <td>{zone.delivered_count}</td>
                      <td className="low">{zone.otd_pct?.toFixed(1) ?? "-"}%</td>
                      <td>{formatTime(zone.avg_delivery_minutes)}</td>
                      <td>
                        {zone.volume_status === "LOW_VOLUME" && (
                          <span className="badge info">Low Volume</span>
                        )}
                        {(zone.otd_pct ?? 0) < 80 && (
                          <span className="badge warning">Below Target</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h3>Zone Drill-Down</h3>
            <div className="breadcrumbs">
              <button
                className={selectedZone ? "btn-ghost" : "btn"}
                type="button"
                onClick={() => {
                  setSelectedZone(null);
                  setSelectedCity(null);
                }}
              >
                All Zones
              </button>
              {selectedZone && (
                <button
                  className={selectedCity ? "btn-ghost" : "btn"}
                  type="button"
                  onClick={() => setSelectedCity(null)}
                >
                  {selectedZone}
                </button>
              )}
              {selectedZone && selectedCity && (
                <span className="breadcrumb-current">{selectedCity}</span>
              )}
            </div>

            {!selectedZone && (
              <p className="muted">Select a zone to drill into its city performance.</p>
            )}
            {selectedZone && !selectedCity && (
              <p className="muted">Select a city to drill into area performance.</p>
            )}

            {selectedZone ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{selectedCity ? "Area" : "City"}</th>
                      <th>Orders</th>
                      <th>Delivered</th>
                      <th>On-Time %</th>
                      <th>Avg Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedCity ? drilldown.areas : drilldown.cities).map((row) => (
                      <tr
                        key={row.zone}
                        onClick={() => {
                          if (!selectedCity) {
                            setSelectedCity(row.zone);
                          }
                        }}
                        className={!selectedCity ? "clickable" : ""}
                      >
                        <td>{row.zone}</td>
                        <td>{row.total_orders}</td>
                        <td>{row.delivered_count}</td>
                        <td>{row.otd_pct?.toFixed(1) ?? "-"}%</td>
                        <td>{formatTime(row.avg_delivery_minutes)}</td>
                        <td>
                          {row.volume_status === "LOW_VOLUME" && (
                            <span className="badge info">Low Volume</span>
                          )}
                          {(row.otd_pct ?? 0) < 80 && (
                            <span className="badge warning">Below Target</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Orders</th>
                      <th>Delivered</th>
                      <th>On-Time %</th>
                      <th>Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldown.zones.map((zone) => (
                      <tr
                        key={zone.zone}
                        className="clickable"
                        onClick={() => {
                          setSelectedZone(zone.zone);
                          setSelectedCity(null);
                        }}
                      >
                        <td>{zone.zone}</td>
                        <td>{zone.total_orders}</td>
                        <td>{zone.delivered_count}</td>
                        <td>{zone.otd_pct?.toFixed(1) ?? "-"}%</td>
                        <td>{formatTime(zone.avg_delivery_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <button className="btn" type="button" onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting..." : "📥 Export Zone Data (CSV)"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}

type AggregateRow = {
  zone: string;
  total_orders: number;
  delivered_count: number;
  on_time_count: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  volume_status: string;
};

function aggregateZones(
  rows: ZoneDetailRow[],
  getKey: (row: ZoneDetailRow) => string,
): AggregateRow[] {
  const map = new Map<
    string,
    {
      zone: string;
      total_orders: number;
      delivered_count: number;
      on_time_count: number;
      total_minutes: number;
      total_delivered: number;
    }
  >();

  rows.forEach((row) => {
    const key = getKey(row) || "Unknown";
    const existing = map.get(key) ?? {
      zone: key,
      total_orders: 0,
      delivered_count: 0,
      on_time_count: 0,
      total_minutes: 0,
      total_delivered: 0,
    };

    existing.total_orders += row.total_orders;
    existing.delivered_count += row.delivered_count;
    existing.on_time_count += row.on_time_count ?? 0;
    if (row.avg_delivery_minutes) {
      existing.total_minutes += row.avg_delivery_minutes * row.delivered_count;
      existing.total_delivered += row.delivered_count;
    }

    map.set(key, existing);
  });

  return Array.from(map.values()).map((entry) => ({
    zone: entry.zone,
    total_orders: entry.total_orders,
    delivered_count: entry.delivered_count,
    on_time_count: entry.on_time_count,
    otd_pct:
      entry.delivered_count > 0
        ? Math.round((entry.on_time_count / entry.delivered_count) * 1000) / 10
        : null,
    avg_delivery_minutes:
      entry.total_delivered > 0 ? Math.round(entry.total_minutes / entry.total_delivered) : null,
    volume_status: entry.total_orders < 5 ? "LOW_VOLUME" : "NORMAL",
  }));
}

function formatTime(minutes: number | null): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}