import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

export type AccessScope =
  | { mode: "full" }
  | { mode: "scoped"; warehouses: string[] };

type PasswordScopeEntry = {
  password: string;
  warehouses: string[] | "*";
};

const VALID_WAREHOUSES = new Set<string>(WAREHOUSE_CODES);

function normalizeWarehouseCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeWarehouseList(warehouses: string[]): string[] {
  return Array.from(
    new Set(
      warehouses
        .map(normalizeWarehouseCode)
        .filter((warehouse) => VALID_WAREHOUSES.has(warehouse)),
    ),
  );
}

function parsePasswordScopesJson(raw: string): PasswordScopeEntry[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];

  const entries: PasswordScopeEntry[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const password = typeof (item as { password?: unknown }).password === "string"
      ? (item as { password: string }).password.trim()
      : "";
    const warehousesRaw = (item as { warehouses?: unknown }).warehouses;

    if (!password) continue;

    if (warehousesRaw === "*") {
      entries.push({ password, warehouses: "*" });
      continue;
    }

    if (!Array.isArray(warehousesRaw)) continue;
    const normalized = normalizeWarehouseList(
      warehousesRaw.filter((value): value is string => typeof value === "string"),
    );
    if (!normalized.length) continue;
    entries.push({ password, warehouses: normalized });
  }

  return entries;
}

function getConfiguredPasswordScopes(): PasswordScopeEntry[] {
  const scopedJson = process.env.DASHBOARD_PASSWORD_SCOPES_JSON?.trim();
  if (scopedJson) {
    try {
      const parsed = parsePasswordScopesJson(scopedJson);
      if (parsed.length) return parsed;
    } catch {
      return [];
    }
  }

  const fallback = process.env.DASHBOARD_PASSWORD?.trim();
  if (!fallback) return [];
  return [{ password: fallback, warehouses: "*" }];
}

export function resolveAccessScopeByPassword(password: string): AccessScope | null {
  const candidate = password.trim();
  if (!candidate) return null;

  const match = getConfiguredPasswordScopes().find((entry) => entry.password === candidate);
  if (!match) return null;

  if (match.warehouses === "*") {
    return { mode: "full" };
  }

  return { mode: "scoped", warehouses: match.warehouses };
}

export function serializeAccessScope(scope: AccessScope): string {
  if (scope.mode === "full") return "full:*";
  return `scoped:${scope.warehouses.join(",")}`;
}

export function parseAccessScope(cookieValue: string | undefined): AccessScope | null {
  if (!cookieValue) return null;
  if (cookieValue === "full:*") return { mode: "full" };

  const [mode, warehouseList = ""] = cookieValue.split(":", 2);
  if (mode !== "scoped") return null;

  const warehouses = normalizeWarehouseList(warehouseList.split(","));
  if (!warehouses.length) return null;
  return { mode: "scoped", warehouses };
}

export function getRequestedWarehouseCode(pathname: string, searchParams: URLSearchParams): string | null {
  const fromQuery =
    searchParams.get("warehouse") ??
    searchParams.get("warehouse_code");
  if (fromQuery) {
    const normalized = normalizeWarehouseCode(fromQuery);
    return VALID_WAREHOUSES.has(normalized) ? normalized : null;
  }

  const shiftPathMatch = pathname.match(/^\/api\/settings\/shifts\/([^/]+)$/);
  if (shiftPathMatch?.[1]) {
    const normalized = normalizeWarehouseCode(decodeURIComponent(shiftPathMatch[1]));
    return VALID_WAREHOUSES.has(normalized) ? normalized : null;
  }

  return null;
}
