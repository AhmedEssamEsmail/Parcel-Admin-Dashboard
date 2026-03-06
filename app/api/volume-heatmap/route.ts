import { NextRequest, NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const GET = withRateLimit(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const mode = params.get("mode")?.trim() === "avg" ? "avg" : "total";
  const orderScope = params.get("orderScope")?.trim().toLowerCase() === "wa" ? "wa" : "normal";

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("v_parcel_kpi")
    .select("warehouse_code,created_date_local,order_local,waiting_address")
    .gte("created_date_local", from)
    .lte("created_date_local", to)
    .limit(20000);

  if (warehouse && warehouse !== "ALL") query = query.eq("warehouse_code", warehouse);
  query = orderScope === "wa" ? query.eq("waiting_address", true) : query.or("waiting_address.is.null,waiting_address.eq.false");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = new Map<string, number>();
  const uniqueDates = new Set<string>();

  for (const row of data ?? []) {
    const orderLocal = row.order_local ? new Date(String(row.order_local)) : null;
    if (!orderLocal || Number.isNaN(orderLocal.getTime())) continue;
    const day = orderLocal.getDay();
    const hour = orderLocal.getHours();
    const key = `${day}-${hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);

    if (row.created_date_local) uniqueDates.add(String(row.created_date_local));
  }

  const dayCount = Math.max(uniqueDates.size, 1);
  const grid = DAY_NAMES.map((dayName, dayIndex) => {
    return Array.from({ length: 24 }).map((_, hour) => {
      const total = counts.get(`${dayIndex}-${hour}`) ?? 0;
      return {
        day: dayName,
        dayIndex,
        hour,
        value: mode === "avg" ? Number((total / dayCount).toFixed(2)) : total,
      };
    });
  }).flat();

  return NextResponse.json({
    mode,
    order_scope: orderScope,
    from,
    to,
    day_count: dayCount,
    grid,
  });
});
