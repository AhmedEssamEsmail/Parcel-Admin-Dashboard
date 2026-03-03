import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE } from "@/lib/auth/constants";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/public")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.match(/\.(?:svg|png|jpg|jpeg|gif|ico|webp|css|js|map)$/)) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const isAuthed = request.cookies.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
  if (isAuthed) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/:path*"],
};

