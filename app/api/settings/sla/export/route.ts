import { NextResponse } from "next/server";

import { withRateLimit } from "@/lib/middleware/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function csvEscape(value: string | number): string {
  const raw = String(value);
  if (raw.includes(",") || raw.includes("\n") || raw.includes('"')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export const GET = withRateLimit(async () => {
  const supabase = getSupabaseAdminClient();

  const [{ data: warehouses, error: warehousesError }, { data: configs, error: configsError }] =
    await Promise.all([
      supabase.from("warehouses").select("id, code"),
      supabase
        .from("warehouse_city_sla_configs")
        .select("warehouse_id, city, sla_minutes")
        .order("warehouse_id", { ascending: true })
        .order("city", { ascending: true }),
    ]);

  if (warehousesError) {
    return NextResponse.json({ error: warehousesError.message }, { status: 500 });
  }

  if (configsError) {
    return NextResponse.json({ error: configsError.message }, { status: 500 });
  }

  const warehouseById = new Map((warehouses ?? []).map((row) => [row.id, row.code]));

  const lines = ["warehouse_code,city,sla_minutes"];
  for (const row of configs ?? []) {
    const warehouseCode = warehouseById.get(row.warehouse_id);
    if (!warehouseCode) continue;
    lines.push(
      [csvEscape(warehouseCode), csvEscape(row.city), csvEscape(row.sla_minutes)].join(","),
    );
  }

  const csv = `${lines.join("\n")}\n`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=city_sla_configs.csv",
      "Cache-Control": "no-store",
    },
  });
});
