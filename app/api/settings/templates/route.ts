import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type TemplatePayload = {
  name?: string;
  config?: unknown;
};

export const GET = withRateLimit(async () => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shift_templates")
    .select("id, name, config, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data ?? [] });
});

export const POST = withRateLimit(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as TemplatePayload | null;
  const name = body?.name?.trim();
  const config = body?.config;

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  if (!config || !Array.isArray(config)) {
    return NextResponse.json({ error: "config must be an array of 7 shift configs." }, { status: 400 });
  }

  if (config.length !== 7) {
    return NextResponse.json({ error: "config must include 7 shift configs." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shift_templates")
    .upsert({ name, config }, { onConflict: "name" })
    .select("id, name, config, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
});