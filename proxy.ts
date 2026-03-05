import { NextRequest, NextResponse } from "next/server";

import {
  getRequestedWarehouseCode,
  parseAccessScope,
} from "@/lib/auth/access";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/public")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.match(/\.(?:svg|png|jpg|jpeg|gif|ico|webp|css|js|map)$/)) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const authScope = parseAccessScope(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!authScope) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
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
