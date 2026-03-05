import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, AUTH_SCOPE_COOKIE_NAME } from "@/lib/auth/constants";
import { withRateLimit } from "@/lib/middleware/rate-limit";

export const POST = withRateLimit(async () => {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: AUTH_SCOPE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
});
