/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

test("fetchPeriodData handles split delivered metrics and invalid timestamps with mocked Supabase", async () => {
  const { fetchPeriodData } = loadTsModule("app/api/compare-periods/route.ts", [
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

  const rows = [
    {
      created_date_local: "2026-03-01",
      parcel_id: 1,
      is_on_time: true,
      delivered_ts: "2026-03-01T12:00:00.000Z",
      delivery_date_local: "2026-03-01",
      is_countable_order: true,
      is_delivered_status: true,
      order_ts_utc: "2026-03-01T10:00:00.000Z",
      waiting_address: false,
    },
    {
      created_date_local: "2026-03-01",
      parcel_id: 2,
      is_on_time: false,
      delivered_ts: "2026-03-01T13:00:00.000Z",
      delivery_date_local: "2026-03-02",
      is_countable_order: true,
      is_delivered_status: true,
      order_ts_utc: "invalid",
      waiting_address: true,
    },
    {
      created_date_local: "2026-03-01",
      parcel_id: 3,
      is_on_time: null,
      delivery_date_local: null,
      delivered_ts: null,
      is_countable_order: true,
      is_delivered_status: false,
      order_ts_utc: "2026-03-01T10:00:00.000Z",
      waiting_address: false,
    },
    {
      created_date_local: "2026-03-01",
      parcel_id: 4,
      is_on_time: false,
      delivered_ts: "2026-03-01T09:59:00.000Z",
      delivery_date_local: "2026-03-01",
      is_countable_order: true,
      is_delivered_status: true,
      order_ts_utc: "2026-03-01T10:00:00.000Z",
      waiting_address: false,
    },
    {
      created_date_local: "2026-02-28",
      parcel_id: 5,
      is_on_time: true,
      delivered_ts: "2026-03-01T08:00:00.000Z",
      delivery_date_local: "2026-03-01",
      is_countable_order: true,
      is_delivered_status: true,
      order_ts_utc: "2026-02-28T09:00:00.000Z",
      waiting_address: false,
    },
    {
      created_date_local: "2026-03-01",
      parcel_id: 6,
      is_on_time: false,
      delivered_ts: null,
      delivery_date_local: null,
      is_countable_order: false,
      is_delivered_status: false,
      order_ts_utc: "2026-03-01T10:00:00.000Z",
      waiting_address: false,
    },
  ];

  const mock = makeSupabaseSelectMock(rows);
  const result = await fetchPeriodData(mock.client, "KUWAIT", "2026-03-01", "2026-03-01");

  assert.equal(mock.selectedTable, "v_parcel_kpi");
  assert.equal(
    mock.selectedColumns,
    "created_date_local, parcel_id, is_on_time, delivered_ts, delivery_date_local, is_countable_order, is_delivered_status, order_ts_utc, waiting_address",
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    total_placed: 4,
    total_delivered: 3,
    total_delivered_delivery_date: 3,
    on_time: 1,
    late: 2,
    otd_pct: 33.33,
    avg_delivery_minutes: 120,
    wa_count: 1,
  });
});

test("rateLimitWithClient enforces threshold and returns 429 with expected headers", async () => {
  const { rateLimitWithClient } = loadTsModule("lib/middleware/rate-limit.ts", [
    {
      from: 'import { NextRequest, NextResponse } from "next/server.js";',
      to: [
        "const NextRequest = class NextRequest {};",
        "class HeaderBag {",
        "  constructor(entries = {}) {",
        "    this.map = new Map();",
        "    for (const [k, v] of Object.entries(entries)) this.map.set(String(k).toLowerCase(), String(v));",
        "  }",
        "  get(name) { return this.map.get(String(name).toLowerCase()) ?? null; }",
        "}",
        "const NextResponse = {",
        "  json: (body, init = {}) => ({",
        "    body,",
        "    status: init.status ?? 200,",
        "    headers: new HeaderBag(init.headers ?? {}),",
        "  }),",
        "};",
      ].join(" "),
    },
    {
      from: 'import { getSupabaseAdminClient } from "../supabase/server";',
      to: "const getSupabaseAdminClient = () => ({ rpc: async () => ({ data: [{ allowed: true, remaining: 99, reset_epoch: 0 }], error: null }) });",
    },
  ]);

  const request = makeRequest({
    forwardedFor: "203.0.113.9, 10.0.0.3",
    referer: "https://localhost:3000/dashboard",
    pathname: "/api/compare-periods",
  });
  const client = makeRateLimitRpcMock({ maxRequests: 2, resetEpoch: 2000000000 });

  const first = await rateLimitWithClient(request, client);
  const second = await rateLimitWithClient(request, client);
  const third = await rateLimitWithClient(request, client);

  assert.equal(first, null);
  assert.equal(second, null);
  assert.ok(third);
  assert.equal(third.status, 429);
  assert.equal(third.headers.get("X-RateLimit-Limit"), "100");
  assert.equal(third.headers.get("X-RateLimit-Remaining"), "0");
  assert.equal(third.headers.get("X-RateLimit-Reset"), "2000000000");
  assert.match(third.headers.get("Retry-After"), /^\d+$/);
  assert.equal(client.lastKey, "203.0.113.9:/api/compare-periods");
  assert.equal(client.callCount, 3);
});

test("rateLimitWithClient applies elevated request cap for /api/ingest", async () => {
  const { rateLimitWithClient } = loadTsModule("lib/middleware/rate-limit.ts", [
    {
      from: 'import { NextRequest, NextResponse } from "next/server.js";',
      to: [
        "const NextRequest = class NextRequest {};",
        "class HeaderBag {",
        "  constructor(entries = {}) {",
        "    this.map = new Map();",
        "    for (const [k, v] of Object.entries(entries)) this.map.set(String(k).toLowerCase(), String(v));",
        "  }",
        "  get(name) { return this.map.get(String(name).toLowerCase()) ?? null; }",
        "}",
        "const NextResponse = {",
        "  json: (body, init = {}) => ({",
        "    body,",
        "    status: init.status ?? 200,",
        "    headers: new HeaderBag(init.headers ?? {}),",
        "  }),",
        "};",
      ].join(" "),
    },
    {
      from: 'import { getSupabaseAdminClient } from "../supabase/server";',
      to: "const getSupabaseAdminClient = () => ({ rpc: async () => ({ data: [{ allowed: true, remaining: 99, reset_epoch: 0 }], error: null }) });",
    },
  ]);

  const request = makeRequest({
    forwardedFor: "203.0.113.9, 10.0.0.3",
    pathname: "/api/ingest",
  });

  const client = makeRateLimitRpcMock({ maxRequests: 1, resetEpoch: 2000000000 });
  const first = await rateLimitWithClient(request, client);
  const second = await rateLimitWithClient(request, client);

  assert.equal(first, null);
  assert.ok(second);
  assert.equal(second.status, 429);
  assert.equal(second.headers.get("X-RateLimit-Limit"), "600");
  assert.equal(client.lastArgs.p_max_requests, 600);
});

test("export API supports new dataset types", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "..", "..", "app/api/export/csv/route.ts"), "utf8");
  assert.match(source, /case "exceptions"/);
  assert.match(source, /case "promise"/);
  assert.match(source, /case "route-efficiency"/);
});

function makeSupabaseSelectMock(rows) {
  const state = {
    selectedTable: "",
    selectedColumns: "",
  };

  const query = {
    select(columns) {
      state.selectedColumns = columns;
      return this;
    },
    eq() {
      return this;
    },
    or() {
      return Promise.resolve({ data: rows, error: null });
    },
  };

  return {
    get selectedTable() {
      return state.selectedTable;
    },
    get selectedColumns() {
      return state.selectedColumns;
    },
    client: {
      from(table) {
        state.selectedTable = table;
        return query;
      },
    },
  };
}

function makeRateLimitRpcMock({ maxRequests, resetEpoch }) {
  const counters = new Map();

  return {
    callCount: 0,
    lastKey: "",
    lastArgs: null,
    async rpc(fn, args) {
      assert.equal(fn, "check_rate_limit");
      this.callCount += 1;
      this.lastKey = args.p_key;
      this.lastArgs = args;

      const current = (counters.get(args.p_key) ?? 0) + 1;
      counters.set(args.p_key, current);
      const threshold = Number.isFinite(maxRequests) ? maxRequests : args.p_max_requests;

      return {
        data: [
          {
            allowed: current <= threshold,
            remaining: Math.max(threshold - current, 0),
            reset_epoch: resetEpoch,
          },
        ],
        error: null,
      };
    },
  };
}

function makeRequest({ forwardedFor, realIp, referer, pathname }) {
  const headerMap = new Map();
  if (forwardedFor) headerMap.set("x-forwarded-for", forwardedFor);
  if (realIp) headerMap.set("x-real-ip", realIp);
  if (referer) headerMap.set("referer", referer);

  return {
    headers: {
      get(name) {
        return headerMap.get(String(name).toLowerCase()) ?? null;
      },
    },
    nextUrl: {
      pathname,
    },
  };
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
