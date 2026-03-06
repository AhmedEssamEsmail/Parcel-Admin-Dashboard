/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

test("compare-periods route selects split delivered metric fields", () => {
  const source = readSource("app/api/compare-periods/route.ts");
  assert.match(
    source,
    /\.select\(\s*"created_date_local, parcel_id, is_on_time, delivered_ts, delivery_date_local, is_countable_order, is_delivered_status, order_ts_utc, waiting_address"/,
  );
  assert.match(source, /total_delivered_delivery_date/);
  assert.match(source, /\.or\(/);
});

test("getDeliveryMinutes guards invalid/negative durations", () => {
  const moduleExports = loadTsModule("app/api/compare-periods/route.ts", [
    {
      from: 'import { NextRequest, NextResponse } from "next/server.js";',
      to: "const NextRequest = class NextRequest {}; const NextResponse = { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers ?? {} }) };",
    },
    {
      from: 'import { withRateLimit } from "../../../lib/middleware/rate-limit";',
      to: "const withRateLimit = (handler) => handler;",
    },
    {
      from: 'import { getSupabaseAdminClient } from "../../../lib/supabase/server";',
      to: "const getSupabaseAdminClient = () => ({});",
    },
  ]);

  assert.equal(
    moduleExports.getDeliveryMinutes({
      order_ts_utc: "2026-03-01T10:00:00.000Z",
      delivered_ts: "2026-03-01T11:30:00.000Z",
    }),
    90,
  );
  assert.equal(
    moduleExports.getDeliveryMinutes({
      order_ts_utc: "invalid",
      delivered_ts: "2026-03-01T11:30:00.000Z",
    }),
    null,
  );
  assert.equal(
    moduleExports.getDeliveryMinutes({
      order_ts_utc: "2026-03-01T12:00:00.000Z",
      delivered_ts: "2026-03-01T11:30:00.000Z",
    }),
    null,
  );
});

test("rate-limit middleware uses Supabase RPC and no referer bypass", () => {
  const source = readSource("lib/middleware/rate-limit.ts");
  assert.match(source, /rpc\("check_rate_limit"/);
  assert.ok(!source.includes('request.headers.get("referer")'));
});

test("getField normalizes punctuation/spacing/case while resolving headers", () => {
  const { getField } = loadTsModule("lib/ingest/normalizers/helpers.ts", []);
  const row = {
    Parcel_Date: "2026-02-08 18:06:13",
    Start_time: "2026-01-20 8:11:47",
    "Duration(min)": "2.2",
  };

  assert.equal(getField(row, ["parcel date"]), "2026-02-08 18:06:13");
  assert.equal(getField(row, ["start time"]), "2026-01-20 8:11:47");
  assert.equal(getField(row, ["duration_min"]), "2.2");
});

test("new operations routes and nav links exist", () => {
  assert.ok(fs.existsSync(path.resolve(__dirname, "..", "..", "app/api/exceptions/route.ts")));
  assert.ok(fs.existsSync(path.resolve(__dirname, "..", "..", "app/api/promise-reliability/route.ts")));
  assert.ok(fs.existsSync(path.resolve(__dirname, "..", "..", "app/api/route-efficiency/route.ts")));

  const navSource = readSource("components/layout/nav.tsx");
  assert.match(navSource, /"\/exceptions"/);
  assert.match(navSource, /"\/promise-reliability"/);
  assert.match(navSource, /"\/route-efficiency"/);
});

test("dashboard and tables expose both delivered concepts", () => {
  const dodTable = readSource("components/tables/dod-summary-table.tsx");
  const wowMomTable = readSource("components/tables/wow-mom-table.tsx");
  const comparisonWidget = readSource("components/widgets/comparison-widget.tsx");
  const routeEfficiencyTable = readSource("components/tables/route-efficiency-table.tsx");

  assert.match(dodTable, /Delivered \(Order Date\)/);
  assert.match(dodTable, /Delivered \(Delivery Date\)/);
  assert.match(wowMomTable, /Delivered \(Order Date\)/);
  assert.match(wowMomTable, /Delivered \(Delivery Date\)/);
  assert.match(comparisonWidget, /Delivered \(Order Date\)/);
  assert.match(comparisonWidget, /Delivered \(Delivery Date\)/);
  assert.match(routeEfficiencyTable, /Delivered \(Delivery Date\)/);
});

test("dashboard combo chart keeps total orders label", () => {
  const source = readSource("components/charts/on-time-combo.tsx");
  assert.match(source, /label: "Total Orders"/);
});

function readSource(relativePath) {
  const fullPath = path.resolve(__dirname, "..", "..", relativePath);
  return fs.readFileSync(fullPath, "utf8");
}

function loadTsModule(relativePath, replacements) {
  const fullPath = path.resolve(__dirname, "..", "..", relativePath);
  let source = fs.readFileSync(fullPath, "utf8");

  for (const replacement of replacements) {
    source = source.replace(replacement.from, replacement.to);
  }

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
    },
    fileName: fullPath,
  }).outputText;

  const compiledModule = { exports: {} };
  const context = vm.createContext({
    require,
    module: compiledModule,
    exports: compiledModule.exports,
    __dirname: path.dirname(fullPath),
    __filename: fullPath,
    process,
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    Date,
    Math,
  });

  new vm.Script(transpiled, { filename: fullPath }).runInContext(context);
  return compiledModule.exports;
}
