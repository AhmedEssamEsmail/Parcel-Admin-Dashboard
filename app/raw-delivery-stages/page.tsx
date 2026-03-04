"use client";

import { useEffect, useState } from "react";

import { AppNav } from "@/components/layout/nav";
import { WAREHOUSE_CODES } from "@/lib/csv/mappings";
import type { RawDeliveryScope } from "@/lib/table/rawDeliveryStages";

type RawRow = Record<string, string | number | null>;

function todayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const COLUMNS = [
  "warehouse",
  "parcel_id",
  "order_placed",
  "collecting",
  "ready_for_preparing",
  "prepare",
  "ready_for_delivery",
  "on_the_way_ts",
  "delivered",
  "address",
  "waiting_address",
  "order_hour",
  "order_date",
  "collect_wait_time",
  "processing",
  "picker_phase",
  "prepare_wait_time",
  "wrapping_phase",
  "delivery_wait_time",
  "on_the_way_duration",
  "time_to_deliver",
  "expected_delivery_time",
  "cutoff_status",
  "expected_time_processing",
  "processing_time",
  "actual_time_processing",
  "processing_time_status",
  "has_a_ticket",
  "ticket_type",
  "expected_time_preparing",
  "actual_time_preparing",
  "preparing_time_status",
  "delivery_kpi",
  "order_status",
  "number_of_items",
  "collector",
  "wrapper",
  "ops_exceeded_30_mins",
  "zone",
  "city",
  "area",
  "expected_time_delivery",
  "actual_time_delivery",
  "delivery_time_status",
  "ops_time",
  "iftar_time",
] as const;

export default function RawDeliveryStagesPage() {
  const [warehouse, setWarehouse] = useState("KUWAIT");
  const [from, setFrom] = useState(todayOffset(-45));
  const [to, setTo] = useState(todayOffset(0));
  const [deliveryScope, setDeliveryScope] = useState<RawDeliveryScope>("delivered");
  const [parcelId, setParcelId] = useState("");
  const [wa, setWa] = useState("all");
  const [kpi, setKpi] = useState("all");
  const [cutoff, setCutoff] = useState("all");
  const [ticket, setTicket] = useState("all");
  const [zone, setZone] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [opsIssue, setOpsIssue] = useState("all");
  const [rows, setRows] = useState<RawRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextOffset = offset) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        warehouse,
        from,
        to,
        delivery_scope: deliveryScope,
        limit: String(limit),
        offset: String(nextOffset),
      });

      if (parcelId) params.set("parcel_id", parcelId);
      if (wa !== "all") params.set("wa", wa);
      if (kpi !== "all") params.set("kpi", kpi);
      if (cutoff !== "all") params.set("cutoff", cutoff);
      if (ticket !== "all") params.set("ticket", ticket);
      if (zone.trim()) params.set("zone", zone.trim());
      if (city.trim()) params.set("city", city.trim());
      if (area.trim()) params.set("area", area.trim());
      if (opsIssue !== "all") params.set("ops_issue", opsIssue);

      const response = await fetch(`/api/raw-delivery-stages?${params.toString()}`);
      const payload = (await response.json()) as {
        rows?: RawRow[];
        totalCount?: number;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Failed to load raw rows.");
        return;
      }

      setRows(payload.rows ?? []);
      setTotalCount(payload.totalCount ?? 0);
      setOffset(nextOffset);
    } catch {
      setError("Network error while loading raw rows.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page-wrap">
      <AppNav />

      <section className="card grid three">
        <label>
          Warehouse
          <select value={warehouse} onChange={(event) => setWarehouse(event.target.value)}>
            {WAREHOUSE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label>
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>

        <label>
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>

        <label>
          Delivery Scope
          <select
            value={deliveryScope}
            onChange={(event) => setDeliveryScope(event.target.value as RawDeliveryScope)}
          >
            <option value="delivered">Delivered</option>
            <option value="all">All</option>
            <option value="not_delivered">Not Delivered</option>
          </select>
        </label>

        <label>
          Parcel ID
          <input value={parcelId} onChange={(event) => setParcelId(event.target.value)} />
        </label>

        <label>
          Waiting Address
          <select value={wa} onChange={(event) => setWa(event.target.value)}>
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>

        <label>
          Delivery KPI
          <select value={kpi} onChange={(event) => setKpi(event.target.value)}>
            <option value="all">All</option>
            <option value="On Time">On Time</option>
            <option value="Late">Late</option>
          </select>
        </label>

        <label>
          Cutoff Status
          <select value={cutoff} onChange={(event) => setCutoff(event.target.value)}>
            <option value="all">All</option>
            <option value="Normal">Normal</option>
            <option value="After Cutoff Time">After Cutoff Time</option>
            <option value="Before Shift">Before Shift</option>
          </select>
        </label>

        <label>
          Has Ticket
          <select value={ticket} onChange={(event) => setTicket(event.target.value)}>
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>

        <label>
          Zone
          <input value={zone} onChange={(event) => setZone(event.target.value)} />
        </label>

        <label>
          City
          <input value={city} onChange={(event) => setCity(event.target.value)} />
        </label>

        <label>
          Area
          <input value={area} onChange={(event) => setArea(event.target.value)} />
        </label>

        <label>
          Ops Issue
          <select value={opsIssue} onChange={(event) => setOpsIssue(event.target.value)}>
            <option value="all">All</option>
            <option value="Ops Issue">Ops Issue</option>
            <option value="Wait on Delivery Issue">Wait on Delivery Issue</option>
          </select>
        </label>

        <div className="btn-row" style={{ gridColumn: "1 / -1" }}>
          <button className="btn" type="button" onClick={() => void load(0)} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => void load(Math.max(0, offset - limit))}
            disabled={loading || offset === 0}
          >
            Prev
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => void load(offset + limit)}
            disabled={loading || offset + limit >= totalCount}
          >
            Next
          </button>
          <span className="muted">Total: {totalCount}</span>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="table-card">
        <h3>Raw Delivery Stages</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="empty-cell">
                    No rows loaded.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.parcel_id}-${index}`}>
                    {COLUMNS.map((column) => (
                      <td key={column}>{String(row[column] ?? "")}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
