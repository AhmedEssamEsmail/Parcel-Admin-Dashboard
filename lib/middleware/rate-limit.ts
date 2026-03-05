import { NextRequest, NextResponse } from "next/server.js";

import { getSupabaseAdminClient } from "../supabase/server";

type RateLimitConfig = {
  windowSeconds: number;
  maxRequests: number;
};

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowSeconds: 15 * 60,
  maxRequests: 100,
};

const RATE_LIMIT_OVERRIDES: Record<string, RateLimitConfig> = {
  "/api/ingest": {
    windowSeconds: 15 * 60,
    maxRequests: 600,
  },
};

type RateLimitResponseRow = {
  allowed: boolean;
  remaining: number;
  reset_epoch: number;
};

type RateLimitRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: RateLimitResponseRow[] | null; error: { message: string } | null }>;
};

function resolveRateLimitConfig(pathname: string): RateLimitConfig {
  return RATE_LIMIT_OVERRIDES[pathname] ?? DEFAULT_RATE_LIMIT;
}

export function resolveClientIp(request: Pick<NextRequest, "headers">): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded
      .split(",")
      .map((value) => value.trim())
      .find((value) => value.length > 0);

    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function buildRateLimitKey(request: Pick<NextRequest, "headers" | "nextUrl">): string {
  return `${resolveClientIp(request)}:${request.nextUrl.pathname}`;
}

export async function rateLimitWithClient(
  request: Pick<NextRequest, "headers" | "nextUrl">,
  client: RateLimitRpcClient,
): Promise<NextResponse | null> {
  const config = resolveRateLimitConfig(request.nextUrl.pathname);
  const key = buildRateLimitKey(request);
  const { data, error } = await client.rpc("check_rate_limit", {
    p_key: key,
    p_window_seconds: config.windowSeconds,
    p_max_requests: config.maxRequests,
  });

  if (error) {
    return NextResponse.json({ error: "Rate limit check failed." }, { status: 500 });
  }

  const limitState = data?.[0];
  if (!limitState || limitState.allowed) {
    return null;
  }

  const retryAfter = Math.max(limitState.reset_epoch - Math.floor(Date.now() / 1000), 0);

  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(config.maxRequests),
        "X-RateLimit-Remaining": String(Math.max(limitState.remaining, 0)),
        "X-RateLimit-Reset": String(limitState.reset_epoch),
        "Retry-After": String(retryAfter),
      },
    },
  );
}

export async function rateLimit(request: NextRequest): Promise<NextResponse | null> {
  const supabase = getSupabaseAdminClient();
  return rateLimitWithClient(request, supabase as RateLimitRpcClient);
}

export function withRateLimit<TContext extends Record<string, unknown> = Record<string, unknown>>(
  handler: (request: NextRequest, context: TContext) => Promise<Response>,
) {
  return async (request: NextRequest, context: TContext) => {
    const limitResponse = await rateLimit(request);
    if (limitResponse) return limitResponse;
    return handler(request, context);
  };
}
