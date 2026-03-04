import { NextRequest, NextResponse } from "next/server.js";

import { getSupabaseAdminClient } from "../supabase/server";

const WINDOW_SECONDS = 15 * 60;
const MAX_REQUESTS = 100;

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
  const key = buildRateLimitKey(request);
  const { data, error } = await client.rpc("check_rate_limit", {
    p_key: key,
    p_window_seconds: WINDOW_SECONDS,
    p_max_requests: MAX_REQUESTS,
  });

  if (error) {
    return NextResponse.json({ error: "Rate limit check failed." }, { status: 500 });
  }

  const limitState = data?.[0];
  if (!limitState || limitState.allowed) {
    return null;
  }

  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(MAX_REQUESTS),
        "X-RateLimit-Remaining": String(Math.max(limitState.remaining, 0)),
        "X-RateLimit-Reset": String(limitState.reset_epoch),
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
