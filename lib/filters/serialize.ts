export type GlobalFilterState = {
  warehouse: string;
  from: string;
  to: string;
};

export type GlobalFilterDefaults = {
  warehouse: string;
  fromOffsetDays: number;
  toOffsetDays?: number;
};

export function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function readGlobalFilters(search: URLSearchParams, defaults: GlobalFilterDefaults): GlobalFilterState {
  return {
    warehouse: search.get("warehouse")?.trim().toUpperCase() || defaults.warehouse,
    from: search.get("from")?.trim() || dateOffset(defaults.fromOffsetDays),
    to: search.get("to")?.trim() || dateOffset(defaults.toOffsetDays ?? 0),
  };
}

export function writeGlobalFilters(
  base: URLSearchParams,
  filters: GlobalFilterState,
  preserveKeys: string[] = [],
): URLSearchParams {
  const next = new URLSearchParams();

  preserveKeys.forEach((key) => {
    const value = base.get(key);
    if (value !== null) next.set(key, value);
  });

  next.set("warehouse", filters.warehouse);
  next.set("from", filters.from);
  next.set("to", filters.to);

  return next;
}
