import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  AUTH_MAX_AGE_SECONDS,
  AUTH_SCOPE_COOKIE_NAME,
} from "@/lib/auth/constants";
import {
  encodeScopeCookie,
  parsePasswordScopeEntries,
  resolvePasswordMatch,
} from "@/lib/auth/scopes";
import { withRateLimit } from "@/lib/middleware/rate-limit";

export const POST = withRateLimit(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;

  const scopedPasswords = parsePasswordScopeEntries(process.env.DASHBOARD_PASSWORD_SCOPES_JSON);
  const fallbackPassword = process.env.DASHBOARD_PASSWORD?.trim();

  const hasScopedPasswords = scopedPasswords.some((entry) => Boolean(entry?.password?.trim()));

  if (!hasScopedPasswords && !fallbackPassword) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD or DASHBOARD_PASSWORD_SCOPES_JSON must be configured." },
      { status: 500 },
    );
  }

  const match = resolvePasswordMatch(body?.password, fallbackPassword, scopedPasswords);
  if (!match) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    scope: match.warehouses,
  });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: serializeAccessScope(accessScope),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE_SECONDS,
  });
  response.cookies.set({
    name: AUTH_SCOPE_COOKIE_NAME,
    value: encodeScopeCookie(match.warehouses),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE_SECONDS,
  });

  return response;
});
