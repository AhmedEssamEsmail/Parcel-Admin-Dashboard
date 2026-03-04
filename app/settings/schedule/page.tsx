"use client";

import { useState } from "react";

import { AppNav } from "@/components/layout/nav";
import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

export default function SchedulePage() {
  const [warehouseCode, setWarehouseCode] = useState("KUWAIT");
  const [shiftDate, setShiftDate] = useState("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseCode,
          shiftDate,
          shiftStart: shiftStart || null,
          shiftEnd: shiftEnd || null,
        }),
      });

      const payload = (await response.json()) as { upsertedCount?: number; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Failed to save override.");
        return;
      }

      setStatus(`Saved ${payload.upsertedCount ?? 0} override row(s).`);
    } catch {
      setError("Network error while saving schedule override.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-wrap">
      <AppNav />

      <section className="card grid two">
        <h1 style={{ gridColumn: "1 / -1" }}>Shift Override</h1>

        <label>
          Warehouse
          <select
            value={warehouseCode}
            onChange={(event) => setWarehouseCode(event.target.value)}
          >
            {WAREHOUSE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label>
          Shift Date
          <input
            type="date"
            value={shiftDate}
            onChange={(event) => setShiftDate(event.target.value)}
          />
        </label>

        <label>
          Shift Start (HH:mm)
          <input
            type="time"
            value={shiftStart}
            onChange={(event) => setShiftStart(event.target.value)}
          />
        </label>

        <label>
          Shift End (HH:mm)
          <input
            type="time"
            value={shiftEnd}
            onChange={(event) => setShiftEnd(event.target.value)}
          />
        </label>

        <div className="btn-row" style={{ gridColumn: "1 / -1" }}>
          <button className="btn" type="button" onClick={() => void save()} disabled={loading}>
            {loading ? "Saving..." : "Save Override"}
          </button>
        </div>

        {status && <p className="success">{status}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
