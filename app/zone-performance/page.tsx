"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AppNav } from "@/components/layout/nav";
import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

type CityRow = {
  city: string;
  total_orders: number;
  delivered_count: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  volume_status: string;
};

type CityDetailRow = {
  city: string;
  zone: string;
  area: string | null;
  total_orders: number;
  delivered_count: number;
  on_time_count: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  volume_status: string;
};

type CityResponse = {
  top?: CityRow[];
  bottom?: CityRow[];
  all?: CityDetailRow[];
};

export default function ZonePerformancePage() {
  const [warehouse, setWarehouse] = useState<string>("KUWAIT");
  const [from, setFrom] = useState<string>(dateOffset(-30));
  const [to, setTo] = useState<string>(dateOffset(0));
  const [data, setData] = useState<CityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ warehouse, from, to });
    const res = await fetch(`/api/zone-performance?${params}`);
    const json = (await res.json()) as CityResponse;
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
    const citySummary = aggregateRows(rows, (row) => getCityValue(row));

    const selectedCityRows = selectedCity
      ? rows.filter((row) => getCityValue(row) === selectedCity)
      : [];

    const areaSummary = aggregateRows(selectedCityRows, (row) => row.area ?? "Unknown");

    return {
      cities: citySummary,
      areas: areaSummary,
    };
  }, [data, selectedCity]);

  return (
    <main className="page-wrap">
      <AppNav />

      <header className="page-header">
        <h1>City Performance</h1>
        <p className="muted">Analyze delivery performance by city.</p>
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
            <h3>Top Performing Cities</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>City</th>
                    <th>Orders</th>
                    <th>Delivered</th>
                    <th>On-Time %</th>
                    <th>Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.top?.map((city, index) => (
                    <tr
                      key={city.city}
                      className="good"
                      onClick={() => {
                        setSelectedCity(city.city);
                      }}
                    >
                      <td>
                        {index === 0 && "#1 "}
                        {index === 1 && "#2 "}
                        {index === 2 && "#3 "}
                        {city.city}
                      </td>
                      <td>{city.total_orders}</td>
                      <td>{city.delivered_count}</td>
                      <td>{city.otd_pct?.toFixed(1) ?? "-"}%</td>
                      <td>{formatTime(city.avg_delivery_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h3>Cities Needing Attention</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>City</th>
                    <th>Orders</th>
                    <th>Delivered</th>
                    <th>On-Time %</th>
                    <th>Avg Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.bottom?.map((city) => (
                    <tr
                      key={city.city}
                      className="warning"
                      onClick={() => {
                        setSelectedCity(city.city);
                      }}
                    >
                      <td>{city.city}</td>
                      <td>{city.total_orders}</td>
                      <td>{city.delivered_count}</td>
                      <td className="low">{city.otd_pct?.toFixed(1) ?? "-"}%</td>
                      <td>{formatTime(city.avg_delivery_minutes)}</td>
                      <td>
                        {city.volume_status === "LOW_VOLUME" && (
                          <span className="badge info">Low Volume</span>
                        )}
                        {(city.otd_pct ?? 0) < 80 && (
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
            <h3>City Drill-Down</h3>
            <div className="breadcrumbs">
              <button
                className={selectedCity ? "btn-ghost" : "btn"}
                type="button"
                onClick={() => {
                  setSelectedCity(null);
                }}
              >
                All Cities
              </button>
              {selectedCity && <span className="breadcrumb-current">{selectedCity}</span>}
            </div>

            {!selectedCity && (
              <p className="muted">Select a city to drill into area performance.</p>
            )}

            {selectedCity ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Area</th>
                      <th>Orders</th>
                      <th>Delivered</th>
                      <th>On-Time %</th>
                      <th>Avg Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldown.areas.map((row) => (
                      <tr key={row.city}>
                        <td>{row.city}</td>
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
                      <th>City</th>
                      <th>Orders</th>
                      <th>Delivered</th>
                      <th>On-Time %</th>
                      <th>Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldown.cities.map((city) => (
                      <tr
                        key={city.city}
                        className="clickable"
                        onClick={() => {
                          setSelectedCity(city.city);
                        }}
                      >
                        <td>{city.city}</td>
                        <td>{city.total_orders}</td>
                        <td>{city.delivered_count}</td>
                        <td>{city.otd_pct?.toFixed(1) ?? "-"}%</td>
                        <td>{formatTime(city.avg_delivery_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <button className="btn" type="button" onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting..." : "Export City Data (CSV)"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}

type AggregateRow = {
  city: string;
  total_orders: number;
  delivered_count: number;
  on_time_count: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  volume_status: string;
};

function aggregateRows(
  rows: CityDetailRow[],
  getKey: (row: CityDetailRow) => string,
): AggregateRow[] {
  const map = new Map<
    string,
    {
      city: string;
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
      city: key,
      total_orders: 0,
      delivered_count: 0,
      on_time_count: 0,
      total_minutes: 0,
      total_delivered: 0,
    };

    existing.total_orders += row.total_orders;
    existing.delivered_count += row.delivered_count;
    existing.on_time_count += row.on_time_count ?? 0;
    if (row.avg_delivery_minutes !== null && row.avg_delivery_minutes !== undefined) {
      existing.total_minutes += row.avg_delivery_minutes * row.delivered_count;
      existing.total_delivered += row.delivered_count;
    }

    map.set(key, existing);
  });

  return Array.from(map.values())
    .map((entry) => ({
      city: entry.city,
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
    }))
    .sort((a, b) => (b.otd_pct ?? 0) - (a.otd_pct ?? 0));
}

function isUnknown(value: string | null | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "unknown" || normalized === "n/a" || normalized === "na" || normalized === "-";
}

function getCityValue(row: CityDetailRow): string {
  if (!isUnknown(row.city)) return row.city.trim();
  if (!isUnknown(row.zone)) return row.zone.trim();
  return "UNKNOWN";
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
