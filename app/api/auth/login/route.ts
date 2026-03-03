import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_VALUE,
  AUTH_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password?.trim();

  if (!process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD is not configured." },
      { status: 500 },
    );
  }

  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: AUTH_COOKIE_VALUE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE_SECONDS,
  });

  return response;
}
