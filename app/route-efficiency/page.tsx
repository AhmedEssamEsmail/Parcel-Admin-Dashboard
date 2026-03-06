"use client";

import { useCallback, useEffect, useState } from "react";

import { DwellTrendChart } from "@/components/charts/dwell-trend";
import { GlobalFilters } from "@/components/filters/global-filters";
import { AppNav } from "@/components/layout/nav";
import { RouteEfficiencyDailyTable } from "@/components/tables/route-efficiency-daily-table";
import { RouteEfficiencyScatterChart } from "@/components/charts/route-efficiency-scatter";
import { RouteEfficiencyTable } from "@/components/tables/route-efficiency-table";
import { useGlobalFilters } from "@/lib/filters/useGlobalFilters";

type DetailedRow = {
  warehouse_code: string;
  day: string;
  city: string;
  total_orders: number;
  delivered_count: number;
  delivered_count_delivery_date: number;
  on_time_count: number;
  active_areas: number;
  parcels_per_active_area: number | null;
  avg_delivery_minutes: number | null;
  otd_pct: number | null;
};

type DailyRow = {
  warehouse_code: string;
  day: string;
  total_orders: number;
  delivered_count: number;
  delivered_count_delivery_date: number;
  on_time_count: number;
  active_areas: number;
  parcels_per_active_area: number | null;
  avg_delivery_minutes: number | null;
  otd_pct: number | null;
};

export default function RouteEfficiencyPage() {
  const { filters, setFilters, appliedFilters, applyFilters } = useGlobalFilters({
    warehouse: "ALL",
    fromOffsetDays: -30,
  });
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [detailedRows, setDetailedRows] = useState<DetailedRow[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams(appliedFilters);
    const res = await fetch(`/api/route-efficiency?${params.toString()}`);
    const payload = (await res.json()) as {
      rows?: DetailedRow[];
      daily_rows?: DailyRow[];
      detailed_rows?: DetailedRow[];
    };

    setDailyRows(payload.daily_rows ?? []);
    setDetailedRows(payload.detailed_rows ?? payload.rows ?? []);
  }, [appliedFilters]);

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
        <h1>Route Efficiency</h1>
        <p className="muted">Observe stop density proxies and operational efficiency trends.</p>
      </header>
      <GlobalFilters filters={filters} onChange={setFilters} onApply={() => applyFilters()} />
      <section className="card">
        <h3>Efficiency Scatter</h3>
        <RouteEfficiencyScatterChart rows={detailedRows} />
      </section>
      <section className="card">
        <h3>Delivery Minutes Trend</h3>
        <DwellTrendChart rows={dailyRows} />
      </section>
      {appliedFilters.warehouse === "ALL" && (
        <section className="card">
          <h3>Daily Aggregate (All Warehouses)</h3>
          <RouteEfficiencyDailyTable rows={dailyRows} />
        </section>
      )}
      <section className="card">
        <h3>{appliedFilters.warehouse === "ALL" ? "Route Efficiency Detailed Breakdown" : "Route Efficiency Table"}</h3>
        <RouteEfficiencyTable rows={detailedRows} />
      </section>
    </main>
  );
}


