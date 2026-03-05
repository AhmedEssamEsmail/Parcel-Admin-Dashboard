"use client";

import { useCallback, useEffect, useState } from "react";

import { GlobalFilters } from "@/components/filters/global-filters";
import { AppNav } from "@/components/layout/nav";
import { useGlobalFilters } from "@/lib/filters/useGlobalFilters";

type Bin = { label: string; count: number };

type Percentile = { day: string; p50: number; p90: number; p95: number };

export default function DistributionsPage() {
  const { filters, setFilters, appliedFilters, applyFilters } = useGlobalFilters({
    warehouse: "ALL",
    fromOffsetDays: -30,
  });

  const [deliveryBins, setDeliveryBins] = useState<Bin[]>([]);
  const [percentiles, setPercentiles] = useState<Percentile[]>([]);
  const [etaSignedBins, setEtaSignedBins] = useState<Bin[]>([]);
  const [etaAbsoluteBins, setEtaAbsoluteBins] = useState<Bin[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams(appliedFilters);
    const [deliveryRes, etaRes] = await Promise.all([
      fetch(`/api/distributions/delivery-time?${params.toString()}`),
      fetch(`/api/distributions/eta-error?${params.toString()}`),
    ]);

    const deliveryPayload = (await deliveryRes.json()) as { bins?: Bin[]; percentiles?: Percentile[] };
    const etaPayload = (await etaRes.json()) as { signed_bins?: Bin[]; absolute_bins?: Bin[] };

    setDeliveryBins(deliveryPayload.bins ?? []);
    setPercentiles(deliveryPayload.percentiles ?? []);
    setEtaSignedBins(etaPayload.signed_bins ?? []);
    setEtaAbsoluteBins(etaPayload.absolute_bins ?? []);
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
        <h1>Distribution Analytics</h1>
        <p className="muted">True histogram bins and percentile trends for delivery and ETA error.</p>
      </header>

      <GlobalFilters filters={filters} onChange={setFilters} onApply={() => applyFilters()} />

      <section className="card">
        <h3>Delivery Time Histogram</h3>
        <SimpleBinsTable bins={deliveryBins} />
      </section>

      <section className="card">
        <h3>Delivery Time Percentile Trend</h3>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Day</th><th>P50</th><th>P90</th><th>P95</th></tr></thead>
            <tbody>
              {percentiles.map((row) => (
                <tr key={row.day}><td>{row.day}</td><td>{row.p50}</td><td>{row.p90}</td><td>{row.p95}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>ETA Error Distribution (Signed)</h3>
        <SimpleBinsTable bins={etaSignedBins} />
      </section>

      <section className="card">
        <h3>ETA Error Distribution (Absolute)</h3>
        <SimpleBinsTable bins={etaAbsoluteBins} />
      </section>
    </main>
  );
}

function SimpleBinsTable({ bins }: { bins: Bin[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>Bin</th><th>Count</th></tr></thead>
        <tbody>
          {bins.map((row) => (
            <tr key={row.label}><td>{row.label}</td><td>{row.count}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


