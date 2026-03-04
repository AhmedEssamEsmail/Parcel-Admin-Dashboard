import { NextRequest, NextResponse } from "next/server";

const rateLimits = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 100;

export function rateLimit(request: NextRequest): NextResponse | null {
  const referer = request.headers.get("referer");
  if (referer?.includes(request.nextUrl.host)) {
    return null;
  }

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const key = `${ip}`;
  const now = Date.now();

  const current = rateLimits.get(key);

  if (!current || now > current.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return null;
  }

  if (current.count >= MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(current.resetTime / 1000)),
        },
      },
    );
  }

  current.count += 1;
  return null;
}

export function withRateLimit<TContext extends Record<string, unknown> = Record<string, unknown>>(
  handler: (request: NextRequest, context: TContext) => Promise<Response>,
) {
  return async (request: NextRequest, context: TContext) => {
    const limitResponse = rateLimit(request);
    if (limitResponse) return limitResponse;
    return handler(request, context);
  };
}