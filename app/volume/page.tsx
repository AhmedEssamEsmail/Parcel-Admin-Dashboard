"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { GlobalFilters } from "@/components/filters/global-filters";
import { AppNav } from "@/components/layout/nav";
import { useGlobalFilters } from "@/lib/filters/useGlobalFilters";

type HeatCell = { day: string; dayIndex: number; hour: number; value: number };

type ForecastPoint = { day: string; value: number };
type OrderScope = "normal" | "wa";

export default function VolumePage() {
  const { filters, setFilters, appliedFilters, applyFilters } = useGlobalFilters({
    warehouse: "ALL",
    fromOffsetDays: -30,
  });
  const [mode, setMode] = useState<"total" | "avg">("total");
  const [orderScope, setOrderScope] = useState<OrderScope>("normal");
  const [heatmap, setHeatmap] = useState<HeatCell[]>([]);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [historical, setHistorical] = useState<ForecastPoint[]>([]);
  const [modelNotes, setModelNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const heatmapParams = new URLSearchParams({ ...appliedFilters, mode, orderScope });
      const forecastParams = new URLSearchParams({ ...appliedFilters, orderScope });
      const [heatmapRes, forecastRes] = await Promise.all([
        fetch(`/api/volume-heatmap?${heatmapParams.toString()}`),
        fetch(`/api/volume-forecast?${forecastParams.toString()}`),
      ]);

      const heatmapPayload = (await heatmapRes.json()) as { grid?: HeatCell[]; error?: string };
      const forecastPayload = (await forecastRes.json()) as {
        historical?: ForecastPoint[];
        forecast?: ForecastPoint[];
        model_notes?: string;
        error?: string;
      };

      if (!heatmapRes.ok) throw new Error(heatmapPayload.error ?? "Failed to load heatmap");
      if (!forecastRes.ok) throw new Error(forecastPayload.error ?? "Failed to load forecast");

      setHeatmap(heatmapPayload.grid ?? []);
      setHistorical(forecastPayload.historical ?? []);
      setForecast(forecastPayload.forecast ?? []);
      setModelNotes(forecastPayload.model_notes ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load volume analytics.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, mode, orderScope]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxValue = useMemo(() => Math.max(1, ...heatmap.map((cell) => cell.value)), [heatmap]);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <main className="page-wrap">
      <AppNav />
      <header className="page-header">
        <h1>Volume Analytics</h1>
        <p className="muted">Order volume heatmap and 7-day capacity forecast for normal or WA orders.</p>
      </header>

      <GlobalFilters
        filters={filters}
        onChange={setFilters}
        onApply={() => applyFilters()}
        trailing={
          <div className="btn-row">
            <button
              className={orderScope === "normal" ? "btn" : "btn-ghost"}
              type="button"
              onClick={() => setOrderScope("normal")}
            >
              Normal Orders
            </button>
            <button
              className={orderScope === "wa" ? "btn" : "btn-ghost"}
              type="button"
              onClick={() => setOrderScope("wa")}
            >
              WA Orders
            </button>
          </div>
        }
      />

      <section className="card">
        <div className="btn-row">
          <button className={mode === "total" ? "btn" : "btn-ghost"} type="button" onClick={() => setMode("total")}>Total</button>
          <button className={mode === "avg" ? "btn" : "btn-ghost"} type="button" onClick={() => setMode("avg")}>Avg / Day</button>
        </div>
      </section>

      {error && <section className="card error">{error}</section>}
      {loading && <section className="card">Loading...</section>}

      {!loading && !error && (
        <section className="card">
          <h3>7x24 Heatmap</h3>
          {heatmap.length === 0 ? (
            <p className="muted">No volume data for this range.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    {Array.from({ length: 24 }).map((_, hour) => (
                      <th key={hour} className="metric-cell">{hour}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dayLabels.map((day, dayIndex) => (
                    <tr key={day}>
                      <td>{day}</td>
                      {Array.from({ length: 24 }).map((_, hour) => {
                        const cell = heatmap.find((item) => item.dayIndex === dayIndex && item.hour === hour);
                        const value = cell?.value ?? 0;
                        const alpha = Math.max(0.08, value / maxValue);
                        return (
                          <td
                            key={`${day}-${hour}`}
                            className="metric-cell"
                            style={{ backgroundColor: `rgba(220,38,38,${alpha})`, color: alpha > 0.5 ? "#fff" : "inherit" }}
                          >
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h3>7-Day Forecast</h3>
        <p className="muted">{modelNotes}</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Date</th><th className="metric-cell">Historical</th><th className="metric-cell">Forecast</th></tr></thead>
            <tbody>
              {historical.slice(-7).map((point) => (
                <tr key={`h-${point.day}`}><td>{point.day}</td><td className="metric-cell">{point.value}</td><td className="metric-cell">-</td></tr>
              ))}
              {forecast.map((point) => (
                <tr key={`f-${point.day}`}><td>{point.day}</td><td className="metric-cell">-</td><td className="metric-cell">{point.value}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
