"use client";

import type { ReactNode } from "react";

import { WAREHOUSE_CODES } from "@/lib/csv/mappings";
import type { GlobalFilterState } from "@/lib/filters/serialize";

type GlobalFiltersProps = {
  filters: GlobalFilterState;
  loading?: boolean;
  includeAllWarehouses?: boolean;
  onChange: (next: GlobalFilterState) => void;
  onApply: () => void;
  trailing?: ReactNode;
};

export function GlobalFilters({
  filters,
  loading,
  includeAllWarehouses = true,
  onChange,
  onApply,
  trailing,
}: GlobalFiltersProps) {
  return (
    <section className="card grid three">
      <label>
        Warehouse
        <select
          value={filters.warehouse}
          onChange={(event) => onChange({ ...filters, warehouse: event.target.value })}
        >
          {includeAllWarehouses && <option value="ALL">All Warehouses</option>}
          {WAREHOUSE_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>

      <label>
        From
        <input
          type="date"
          value={filters.from}
          onChange={(event) => onChange({ ...filters, from: event.target.value })}
        />
      </label>

      <label>
        To
        <input
          type="date"
          value={filters.to}
          onChange={(event) => onChange({ ...filters, to: event.target.value })}
        />
      </label>

      <div className="btn-row" style={{ alignItems: "end", gridColumn: "1 / -1" }}>
        <button className="btn" type="button" onClick={onApply} disabled={loading}>
          {loading ? "Loading..." : "Apply"}
        </button>
        {trailing}
      </div>
    </section>
  );
}
