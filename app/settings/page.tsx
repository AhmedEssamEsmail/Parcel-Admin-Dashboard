"use client";

import { useEffect, useMemo, useState } from "react";

import { AppNav } from "@/components/layout/nav";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  sla_minutes: number;
  default_shift_start: string;
  default_shift_end: string;
  tz: string;
};

type ShiftConfig = {
  day_of_week: number;
  shift_start: string;
  shift_end: string;
  is_active: boolean;
};

type OverrideRow = {
  id: string;
  warehouse_id: string;
  override_date: string;
  shift_start: string | null;
  shift_end: string | null;
  reason: string;
};

type ShiftTemplate = {
  id: string;
  name: string;
  config: ShiftConfig[];
};

type TabKey = "warehouses" | "shifts" | "holidays" | "templates";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("warehouses");

  return (
    <main className="page-wrap">
      <AppNav />

      <header className="page-header">
        <h1>Settings</h1>
        <p className="muted">Configure SLA, shift windows, and holiday overrides.</p>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === "warehouses" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("warehouses")}
        >
          Warehouses
        </button>
        <button
          className={activeTab === "shifts" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("shifts")}
        >
          Shifts
        </button>
        <button
          className={activeTab === "holidays" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("holidays")}
        >
          Holidays
        </button>
        <button
          className={activeTab === "templates" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("templates")}
        >
          Templates
        </button>
      </nav>

      {activeTab === "warehouses" && <WarehousesTab />}
      {activeTab === "shifts" && <ShiftsTab />}
      {activeTab === "holidays" && <HolidaysTab />}
      {activeTab === "templates" && <ShiftTemplatesTab />}
    </main>
  );
}

function WarehousesTab() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/settings");
      const payload = (await response.json()) as { warehouses?: Warehouse[]; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Failed to load warehouses.");
        return;
      }

      setWarehouses(payload.warehouses ?? []);
    } catch {
      setError("Network error while loading warehouses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWarehouses();
  }, []);

  const updateSla = async (warehouseId: string, slaMinutes: number) => {
    setSavingId(warehouseId);
    setError(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id: warehouseId, sla_minutes: slaMinutes }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Failed to update SLA.");
      }
    } catch {
      setError("Network error while updating SLA.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <section className="card">Loading warehouses...</section>;
  }

  return (
    <section className="card">
      <h2>Warehouse SLA Settings</h2>
      <p className="muted">Adjust SLA minutes. Changes apply to new uploads.</p>

      {error && <p className="error">{error}</p>}

      <div className="table-scroll">
        <table className="settings-table">
          <thead>
            <tr>
              <th>Warehouse</th>
              <th>SLA (minutes)</th>
              <th>Default Shift Start</th>
              <th>Default Shift End</th>
              <th>Timezone</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((warehouse) => (
              <tr key={warehouse.id}>
                <td>{warehouse.name}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={warehouse.sla_minutes}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10) || 0;
                      setWarehouses((prev) =>
                        prev.map((item) =>
                          item.id === warehouse.id
                            ? { ...item, sla_minutes: value }
                            : item,
                        ),
                      );
                    }}
                    onBlur={() => void updateSla(warehouse.id, warehouse.sla_minutes)}
                    disabled={savingId === warehouse.id}
                  />
                </td>
                <td>{warehouse.default_shift_start}</td>
                <td>{warehouse.default_shift_end}</td>
                <td>{warehouse.tz}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ShiftsTab() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const loadWarehouses = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/settings");
        const payload = (await response.json()) as { warehouses?: Warehouse[]; error?: string };
        if (!response.ok) {
          setError(payload.error ?? "Failed to load warehouses.");
          return;
        }

        const list = payload.warehouses ?? [];
        setWarehouses(list);
        setSelectedWarehouse((prev) => prev || list[0]?.code || "");
      } catch {
        setError("Network error while loading warehouses.");
      } finally {
        setLoading(false);
      }
    };

    void loadWarehouses();
  }, []);

  useEffect(() => {
    const fetchShifts = async () => {
      if (!selectedWarehouse) return;
      setError(null);
      setStatus(null);

      try {
        const response = await fetch(`/api/settings/shifts/${selectedWarehouse}`);
        const payload = (await response.json()) as { shifts?: ShiftConfig[]; error?: string };
        if (!response.ok) {
          setError(payload.error ?? "Failed to load shifts.");
          return;
        }
        setShifts(payload.shifts ?? []);
      } catch {
        setError("Network error while loading shifts.");
      }
    };

    void fetchShifts();
  }, [selectedWarehouse]);

  const saveShifts = async () => {
    if (!selectedWarehouse) return;
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/settings/shifts/${selectedWarehouse}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shifts }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to save shifts.");
        return;
      }

      setStatus("Shift configuration saved.");
    } catch {
      setError("Network error while saving shifts.");
    } finally {
      setSaving(false);
    }
  };

  const sortedShifts = useMemo(
    () => [...shifts].sort((a, b) => a.day_of_week - b.day_of_week),
    [shifts],
  );

  if (loading) {
    return <section className="card">Loading shifts...</section>;
  }

  return (
    <section className="card">
      <h2>Weekly Shift Configuration</h2>
      <p className="muted">Configure shift windows per day. End time must be after start.</p>

      {error && <p className="error">{error}</p>}
      {status && <p className="success">{status}</p>}

      <label className="field-inline">
        Warehouse
        <select
          value={selectedWarehouse}
          onChange={(event) => setSelectedWarehouse(event.target.value)}
        >
          {warehouses.map((warehouse) => (
            <option key={warehouse.code} value={warehouse.code}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </label>

      <div className="table-scroll">
        <table className="settings-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Start</th>
              <th>End</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {sortedShifts.map((shift, index) => (
              <tr key={shift.day_of_week}>
                <td>{DAYS[shift.day_of_week]}</td>
                <td>
                  <input
                    type="time"
                    value={shift.shift_start}
                    onChange={(event) => {
                      const next = [...sortedShifts];
                      next[index] = { ...shift, shift_start: event.target.value };
                      setShifts(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={shift.shift_end}
                    onChange={(event) => {
                      const next = [...sortedShifts];
                      next[index] = { ...shift, shift_end: event.target.value };
                      setShifts(next);
                    }}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={shift.is_active}
                    onChange={(event) => {
                      const next = [...sortedShifts];
                      next[index] = { ...shift, is_active: event.target.checked };
                      setShifts(next);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="btn-row">
        <button className="btn" type="button" onClick={() => void saveShifts()} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </section>
  );
}

function HolidaysTab() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [warehouseCode, setWarehouseCode] = useState("ALL");
  const [overrideDate, setOverrideDate] = useState("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [reason, setReason] = useState("");
  const [bulkStart, setBulkStart] = useState("");
  const [bulkEnd, setBulkEnd] = useState("");
  const [bulkStartTime, setBulkStartTime] = useState("");
  const [bulkEndTime, setBulkEndTime] = useState("");
  const [bulkReason, setBulkReason] = useState("Ramadan");
  const [bulkApplyAll, setBulkApplyAll] = useState(true);
  const [ramadanMode, setRamadanMode] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [editingOverride, setEditingOverride] = useState<OverrideRow | null>(null);
  const [editShiftStart, setEditShiftStart] = useState("");
  const [editShiftEnd, setEditShiftEnd] = useState("");
  const [editReason, setEditReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadInitial = async () => {
    setLoading(true);
    setError(null);

    try {
      const [warehousesResponse, overridesResponse] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/settings/overrides"),
      ]);

      const warehousesPayload = (await warehousesResponse.json()) as {
        warehouses?: Warehouse[];
        error?: string;
      };
      const overridesPayload = (await overridesResponse.json()) as {
        overrides?: OverrideRow[];
        error?: string;
      };

      if (!warehousesResponse.ok) {
        setError(warehousesPayload.error ?? "Failed to load warehouses.");
        return;
      }

      if (!overridesResponse.ok) {
        setError(overridesPayload.error ?? "Failed to load overrides.");
        return;
      }

      const warehousesList = warehousesPayload.warehouses ?? [];
      setWarehouses(warehousesList);
      setOverrides(overridesPayload.overrides ?? []);
    } catch {
      setError("Network error while loading overrides.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInitial();
  }, []);

  const refreshOverrides = async () => {
    const response = await fetch("/api/settings/overrides");
    const payload = (await response.json()) as { overrides?: OverrideRow[]; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to refresh overrides.");
      return;
    }
    setOverrides(payload.overrides ?? []);
  };

  const monthOverrides = useMemo(
    () => overrides.filter((override) => override.override_date.startsWith(calendarMonth)),
    [overrides, calendarMonth],
  );

  const warehouseCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    warehouses.forEach((warehouse) => {
      map.set(warehouse.id, warehouse.code);
    });
    return map;
  }, [warehouses]);

  const addOverride = async () => {
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/settings/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_code: warehouseCode,
          override_date: overrideDate,
          shift_start: shiftStart || null,
          shift_end: shiftEnd || null,
          reason,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to create override.");
        return;
      }

      setStatus("Override saved.");
      await refreshOverrides();
    } catch {
      setError("Network error while creating override.");
    }
  };

  const addBulk = async () => {
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/settings/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_code: bulkApplyAll ? "ALL" : warehouseCode,
          start_date: bulkStart,
          end_date: bulkEnd,
          shift_start: bulkStartTime,
          shift_end: bulkEndTime,
          reason: bulkReason,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to create bulk overrides.");
        return;
      }

      setStatus("Bulk overrides saved.");
      await refreshOverrides();
    } catch {
      setError("Network error while creating bulk overrides.");
    }
  };

  const updateOverride = async () => {
    if (!editingOverride) return;
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/settings/overrides/${editingOverride.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_start: editShiftStart || null,
          shift_end: editShiftEnd || null,
          reason: editReason,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to update override.");
        return;
      }

      setStatus("Override updated.");
      setEditingOverride(null);
      await refreshOverrides();
    } catch {
      setError("Network error while updating override.");
    }
  };

  const applyRamadanDefaults = () => {
    setBulkReason("Ramadan");
    setBulkStartTime("20:00");
    setBulkEndTime("02:00");
  };

  const deleteOverride = async (id: string) => {
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/settings/overrides/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to delete override.");
        return;
      }
      setStatus("Override deleted.");
      await refreshOverrides();
    } catch {
      setError("Network error while deleting override.");
    }
  };

  if (loading) {
    return <section className="card">Loading overrides...</section>;
  }

  return (
    <section className="card">
      <h2>Holiday & Override Management</h2>
      <p className="muted">Create single or bulk overrides. Leave times empty to mark closed.</p>

      {error && <p className="error">{error}</p>}
      {status && <p className="success">{status}</p>}

      <div className="card section-card">
        <h3>Add Single Override</h3>
        <div className="grid three">
          <label>
            Warehouse
            <select value={warehouseCode} onChange={(event) => setWarehouseCode(event.target.value)}>
              <option value="ALL">All Warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.code} value={warehouse.code}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input type="date" value={overrideDate} onChange={(event) => setOverrideDate(event.target.value)} />
          </label>

          <label>
            Reason
            <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        </div>

        <div className="grid three">
          <label>
            Shift Start
            <input type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} />
          </label>

          <label>
            Shift End
            <input type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} />
          </label>

          <div className="btn-row" style={{ alignItems: "end" }}>
            <button className="btn" type="button" onClick={() => void addOverride()}>
              Save Override
            </button>
          </div>
        </div>
      </div>

      <div className="card section-card">
        <h3>Bulk Add (Ramadan)</h3>
        <label className="field-inline">
          <input
            type="checkbox"
            checked={ramadanMode}
            onChange={(event) => {
              const enabled = event.target.checked;
              setRamadanMode(enabled);
              if (enabled) applyRamadanDefaults();
            }}
          />
          Ramadan Mode {ramadanMode ? "Enabled" : "Disabled"}
        </label>
        <div className="grid three">
          <label>
            Apply To
            <select value={bulkApplyAll ? "ALL" : warehouseCode} onChange={(event) => {
              const value = event.target.value;
              if (value === "ALL") {
                setBulkApplyAll(true);
              } else {
                setBulkApplyAll(false);
                setWarehouseCode(value);
              }
            }}>
              <option value="ALL">All Warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.code} value={warehouse.code}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start Date
            <input type="date" value={bulkStart} onChange={(event) => setBulkStart(event.target.value)} />
          </label>
          <label>
            End Date
            <input type="date" value={bulkEnd} onChange={(event) => setBulkEnd(event.target.value)} />
          </label>
          <label>
            Reason
            <input type="text" value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} />
          </label>
        </div>

        <div className="grid three">
          <label>
            Shift Start
            <input
              type="time"
              value={bulkStartTime}
              onChange={(event) => setBulkStartTime(event.target.value)}
            />
          </label>
          <label>
            Shift End
            <input
              type="time"
              value={bulkEndTime}
              onChange={(event) => setBulkEndTime(event.target.value)}
            />
          </label>
          <div className="btn-row" style={{ alignItems: "end" }}>
            <button className="btn" type="button" onClick={() => void addBulk()}>
              Save Bulk Overrides
            </button>
          </div>
        </div>
      </div>

      <div className="card section-card">
        <h3>Overrides Calendar</h3>
        <div className="grid two">
          <label>
            Month
            <input
              type="month"
              value={calendarMonth}
              onChange={(event) => setCalendarMonth(event.target.value)}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Warehouse</th>
                <th>Start</th>
                <th>End</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {monthOverrides.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No overrides in this month.
                  </td>
                </tr>
              ) : (
                monthOverrides.map((override) => (
                  <tr key={override.id}>
                    <td>{override.override_date}</td>
                    <td>{warehouseCodeMap.get(override.warehouse_id) ?? override.warehouse_id}</td>
                    <td>{override.shift_start ?? "Closed"}</td>
                    <td>{override.shift_end ?? "Closed"}</td>
                    <td>{override.reason}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => {
                          setEditingOverride(override);
                          setEditShiftStart(override.shift_start ?? "");
                          setEditShiftEnd(override.shift_end ?? "");
                          setEditReason(override.reason ?? "");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => void deleteOverride(override.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingOverride && (
        <div className="card section-card">
          <h3>Edit Override</h3>
          <div className="grid three">
            <label>
              Shift Start
              <input
                type="time"
                value={editShiftStart}
                onChange={(event) => setEditShiftStart(event.target.value)}
              />
            </label>
            <label>
              Shift End
              <input
                type="time"
                value={editShiftEnd}
                onChange={(event) => setEditShiftEnd(event.target.value)}
              />
            </label>
            <label>
              Reason
              <input
                type="text"
                value={editReason}
                onChange={(event) => setEditReason(event.target.value)}
              />
            </label>
          </div>
          <div className="btn-row">
            <button className="btn" type="button" onClick={() => void updateOverride()}>
              Save Changes
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setEditingOverride(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ShiftTemplatesTab() {
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/settings/templates");
      const payload = (await response.json()) as { templates?: ShiftTemplate[]; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to load templates.");
        return;
      }

      const list = payload.templates ?? [];
      setTemplates(list);
    } catch {
      setError("Network error while loading templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadShifts = async () => {
      try {
        const warehouseResponse = await fetch("/api/settings");
        const warehousePayload = (await warehouseResponse.json()) as {
          warehouses?: Warehouse[];
          error?: string;
        };
        if (!warehouseResponse.ok) {
          setError(warehousePayload.error ?? "Failed to load warehouses.");
          return;
        }
        const defaultCode = warehousePayload.warehouses?.[0]?.code;
        if (!defaultCode) return;
        const shiftsResponse = await fetch(`/api/settings/shifts/${defaultCode}`);
        const shiftsPayload = (await shiftsResponse.json()) as {
          shifts?: ShiftConfig[];
          error?: string;
        };
        if (!shiftsResponse.ok) {
          setError(shiftsPayload.error ?? "Failed to load shifts.");
          return;
        }
        setShifts(shiftsPayload.shifts ?? []);
      } catch {
        setError("Network error while loading shift config.");
      }
    };

    void loadTemplates();
    void loadShifts();
  }, []);

  const saveTemplate = async () => {
    if (!templateName.trim()) return;
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/settings/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName.trim(), config: shifts }),
      });

      const payload = (await response.json()) as { template?: ShiftTemplate; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Failed to save template.");
        return;
      }

      if (payload.template) {
        setTemplates((prev) => {
          const next = prev.filter((item) => item.id !== payload.template!.id);
          return [payload.template!, ...next];
        });
      }
      setTemplateName("");
      setStatus("Template saved.");
    } catch {
      setError("Network error while saving template.");
    }
  };

  const applyTemplate = () => {
    const template = templates.find((item) => item.id === selectedTemplate);
    if (!template) return;
    setShifts(template.config ?? []);
    setStatus(`Applied template: ${template.name}`);
  };

  return (
    <section className="card">
      <h2>Shift Templates</h2>
      <p className="muted">Save or apply preset weekly shift templates.</p>

      {error && <p className="error">{error}</p>}
      {status && <p className="success">{status}</p>}

      <div className="grid two">
        <label>
          Template Name
          <input
            type="text"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Standard Week"
          />
        </label>
        <div className="btn-row" style={{ alignItems: "end" }}>
          <button
            className="btn"
            type="button"
            onClick={() => void saveTemplate()}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Current as Template"}
          </button>
        </div>
      </div>

      <div className="grid two">
        <label>
          Apply Template
          <select
            value={selectedTemplate}
            onChange={(event) => setSelectedTemplate(event.target.value)}
          >
            <option value="">Select Template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <div className="btn-row" style={{ alignItems: "end" }}>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={!selectedTemplate}
            onClick={applyTemplate}
          >
            Apply Template
          </button>
        </div>
      </div>
    </section>
  );
}