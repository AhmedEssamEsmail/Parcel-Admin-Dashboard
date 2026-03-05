import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  AUTH_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";
import {
  resolveAccessScopeByPassword,
  serializeAccessScope,
} from "@/lib/auth/access";
import { withRateLimit } from "@/lib/middleware/rate-limit";

export const POST = withRateLimit(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password?.trim();

  if (
    !process.env.DASHBOARD_PASSWORD &&
    !process.env.DASHBOARD_PASSWORD_SCOPES_JSON
  ) {
    return NextResponse.json(
      { error: "Dashboard password configuration is missing." },
      { status: 500 },
    );
  }

  const accessScope = password ? resolveAccessScopeByPassword(password) : null;
  if (!accessScope) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: serializeAccessScope(accessScope),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE_SECONDS,
  });

  return response;
});
