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

function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none';"
  );

  // HTTP Strict Transport Security
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  // X-Frame-Options
  response.headers.set('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || isPublicAsset(pathname)) {
    return addSecurityHeaders(NextResponse.next());
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
          return addSecurityHeaders(NextResponse.rewrite(rewritten));
        }
      }
    }

    return addSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/api/")) {
    return addSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return addSecurityHeaders(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/:path*"],
};
