import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_VALUE,
  AUTH_SCOPE_COOKIE_NAME,
  AUTH_SCOPE_FULL_ACCESS,
} from "@/lib/auth/constants";
import { decodeScopeCookie, isWarehouseAllowed } from "@/lib/auth/scopes";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/public")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.match(/\.(?:svg|png|jpg|jpeg|gif|ico|webp|css|js|map)$/)) return true;
  return false;
}

function getRequestedWarehouse(request: NextRequest): string | null {
  const queryWarehouse =
    request.nextUrl.searchParams.get("warehouse") ??
    request.nextUrl.searchParams.get("warehouseCode") ??
    request.nextUrl.searchParams.get("warehouse_code");

  if (!queryWarehouse) {
    return null;
  }

  return queryWarehouse.trim().toUpperCase();
}

export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const isAuthed = request.cookies.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
  if (isAuthed) {
    const allowedWarehouses = decodeScopeCookie(request.cookies.get(AUTH_SCOPE_COOKIE_NAME)?.value);

    if (allowedWarehouses !== AUTH_SCOPE_FULL_ACCESS) {
      const requestedWarehouse = getRequestedWarehouse(request);
      if (requestedWarehouse) {
        const fallbackWarehouse = allowedWarehouses[0];
        const needsRewrite =
          requestedWarehouse === "ALL" ||
          !isWarehouseAllowed(requestedWarehouse, allowedWarehouses);

        if (needsRewrite && fallbackWarehouse) {
          const rewritten = request.nextUrl.clone();
          if (rewritten.searchParams.has("warehouse")) {
            rewritten.searchParams.set("warehouse", fallbackWarehouse);
          }
          if (rewritten.searchParams.has("warehouseCode")) {
            rewritten.searchParams.set("warehouseCode", fallbackWarehouse);
          }
          if (rewritten.searchParams.has("warehouse_code")) {
            rewritten.searchParams.set("warehouse_code", fallbackWarehouse);
          }
          return NextResponse.rewrite(rewritten);
        }
      }
    }

    return NextResponse.next();
  }

  if (
    authScope.mode === "scoped" &&
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/")
  ) {
    if (request.method !== "GET") {
      return NextResponse.json(
        { error: "This password is read-only and restricted to assigned warehouse data." },
        { status: 403 },
      );
    }

    const requestedWarehouse = getRequestedWarehouseCode(pathname, searchParams);
    if (!requestedWarehouse || !authScope.warehouses.includes(requestedWarehouse)) {
      return NextResponse.json(
        { error: "This password cannot access the requested warehouse." },
        { status: 403 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
