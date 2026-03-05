import { AUTH_SCOPE_FULL_ACCESS } from "@/lib/auth/constants";

export type PasswordScopeEntry = {
  password?: string;
  warehouses?: string[] | "*";
};

export type PasswordMatch = {
  password: string;
  warehouses: string[] | "*";
};

export function parsePasswordScopeEntries(raw: string | undefined): PasswordScopeEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as PasswordScopeEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeWarehouses(value: PasswordScopeEntry["warehouses"]): string[] | "*" {
  if (value === "*") {
    return AUTH_SCOPE_FULL_ACCESS;
  }

  if (!Array.isArray(value)) {
    return AUTH_SCOPE_FULL_ACCESS;
  }

  const normalized = value
    .map((warehouse) => warehouse?.trim().toUpperCase())
    .filter((warehouse): warehouse is string => Boolean(warehouse));

  return normalized.length ? normalized : AUTH_SCOPE_FULL_ACCESS;
}

export function resolvePasswordMatch(
  rawPassword: string | undefined,
  fallbackPassword: string | undefined,
  scopeEntries: PasswordScopeEntry[],
): PasswordMatch | null {
  const password = rawPassword?.trim();
  if (!password) {
    return null;
  }

  for (const entry of scopeEntries) {
    const entryPassword = entry?.password?.trim();
    if (entryPassword && entryPassword === password) {
      return {
        password: entryPassword,
        warehouses: normalizeWarehouses(entry.warehouses),
      };
    }
  }

  const normalizedFallback = fallbackPassword?.trim();
  if (normalizedFallback && normalizedFallback === password) {
    return { password: normalizedFallback, warehouses: AUTH_SCOPE_FULL_ACCESS };
  }

  return null;
}

export function encodeScopeCookie(warehouses: string[] | "*"): string {
  if (warehouses === AUTH_SCOPE_FULL_ACCESS) {
    return AUTH_SCOPE_FULL_ACCESS;
  }

  return warehouses.join(",");
}

export function decodeScopeCookie(raw: string | undefined): string[] | "*" {
  if (!raw || raw === AUTH_SCOPE_FULL_ACCESS) {
    return AUTH_SCOPE_FULL_ACCESS;
  }

  const normalized = raw
    .split(",")
    .map((warehouse) => warehouse.trim().toUpperCase())
    .filter(Boolean);

  return normalized.length ? normalized : AUTH_SCOPE_FULL_ACCESS;
}

export function isWarehouseAllowed(
  requestedWarehouse: string,
  allowedWarehouses: string[] | "*",
): boolean {
  if (allowedWarehouses === AUTH_SCOPE_FULL_ACCESS) {
    return true;
  }

  return allowedWarehouses.includes(requestedWarehouse.trim().toUpperCase());
}
