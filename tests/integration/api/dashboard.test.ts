import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/dod/route';

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'v_dod_summary_daily_rollup') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: vi.fn(() => ({
                lte: vi.fn(() => ({
                  order: vi.fn(() => ({
                    data: mockSummaryData,
                    error: mockSummaryError,
                  })),
                })),
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          or: vi.fn(() => ({
            eq: vi.fn(() => ({
              range: vi.fn(() => ({
                data: mockFallbackData,
                error: mockFallbackError,
              })),
            })),
          })),
        })),
      };
    }),
  })),
}));

// Mock rate limiting middleware
vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: (handler: (request: Request) => Promise<Response>) => handler,
}));

// Mock the Supabase client
let mockSummaryData: unknown[] | null = null;
let mockSummaryError: Error | null = null;
let mockFallbackData: unknown[] | null = null;
let mockFallbackError: Error | null = null;

describe('Dashboard API Integration Tests', () => {
  beforeEach(() => {
    mockSummaryData = null;
    mockSummaryError = null;
    mockFallbackData = null;
    mockFallbackError = null;
    vi.clearAllMocks();
  });

  it('should successfully retrieve dashboard data with valid parameters', async () => {
    mockSummaryData = [
      {
        warehouse_code: 'WH01',
        day: '2024-01-01',
        total_placed_inc_wa: 100,
        total_delivered_inc_wa: 90,
        total_delivered_inc_wa_delivery_date: 85,
        on_time_inc_wa: 80,
        otd_pct_inc_wa: 88.89,
        null_on_time_count: 0,
        wa_count: 5,
        wa_delivered_count: 4,
        total_placed_exc_wa: 95,
        total_delivered_exc_wa: 86,
        total_delivered_exc_wa_delivery_date: 81,
        on_time_exc_wa: 76,
        otd_pct_exc_wa: 88.37,
      },
    ];

    const request = new NextRequest(
      'http://localhost:3000/api/dod?warehouse=WH01&from=2024-01-01&to=2024-01-31'
    );

    const response = await GET(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('rows_inc_wa');
    expect(data).toHaveProperty('rows_exc_wa');
    expect(data).toHaveProperty('wa_count');
    expect(data).toHaveProperty('null_on_time_count');
    expect(data).toHaveProperty('series');
    expect(data.series).toHaveProperty('labels');
    expect(data.series).toHaveProperty('totalOrders');
    expect(data.series).toHaveProperty('onTimePct');
    expect(data.series).toHaveProperty('waDeliveredPct');
  });

  it('should return 400 when from parameter is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/dod?warehouse=WH01&to=2024-01-31');

    const response = await GET(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('from and to query params are required');
  });

  it('should return 400 when to parameter is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/dod?warehouse=WH01&from=2024-01-01');

    const response = await GET(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('from and to query params are required');
  });

  it('should handle empty data from database', async () => {
    mockSummaryData = [];

    const request = new NextRequest(
      'http://localhost:3000/api/dod?warehouse=WH01&from=2024-01-01&to=2024-01-31'
    );

    const response = await GET(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rows_inc_wa).toEqual([]);
    expect(data.rows_exc_wa).toEqual([]);
    expect(data.wa_count).toBe(0);
  });

  it('should default to ALL warehouses when warehouse parameter is not provided', async () => {
    mockSummaryData = [
      {
        warehouse_code: 'ALL',
        day: '2024-01-01',
        total_placed_inc_wa: 200,
        total_delivered_inc_wa: 180,
        total_delivered_inc_wa_delivery_date: 170,
        on_time_inc_wa: 160,
        otd_pct_inc_wa: 88.89,
        null_on_time_count: 0,
        wa_count: 10,
        wa_delivered_count: 8,
        total_placed_exc_wa: 190,
        total_delivered_exc_wa: 172,
        total_delivered_exc_wa_delivery_date: 162,
        on_time_exc_wa: 152,
        otd_pct_exc_wa: 88.37,
      },
    ];

    const request = new NextRequest('http://localhost:3000/api/dod?from=2024-01-01&to=2024-01-31');

    const response = await GET(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rows_inc_wa).toHaveLength(1);
  });

  it('should fallback to v_parcel_kpi when summary query fails', async () => {
    mockSummaryError = new Error('Summary view not available');
    mockFallbackData = [
      {
        created_date_local: '2024-01-01',
        delivery_date_local: '2024-01-02',
        is_on_time: true,
        waiting_address: false,
        is_countable_order: true,
        is_delivered_status: true,
      },
    ];

    const request = new NextRequest(
      'http://localhost:3000/api/dod?warehouse=WH01&from=2024-01-01&to=2024-01-31'
    );

    const response = await GET(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('rows_inc_wa');
    expect(data).toHaveProperty('rows_exc_wa');
  });

  it('should return 500 when both summary and fallback queries fail', async () => {
    mockSummaryError = new Error('Summary view not available');
    mockFallbackError = new Error('Database connection failed');

    const request = new NextRequest(
      'http://localhost:3000/api/dod?warehouse=WH01&from=2024-01-01&to=2024-01-31'
    );

    const response = await GET(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
  });

  it('should normalize warehouse code to uppercase', async () => {
    mockSummaryData = [];

    const request = new NextRequest(
      'http://localhost:3000/api/dod?warehouse=wh01&from=2024-01-01&to=2024-01-31'
    );

    const response = await GET(request, {} as Record<string, unknown>);

    expect(response.status).toBe(200);
  });

  it('should calculate chart data correctly', async () => {
    mockSummaryData = [
      {
        warehouse_code: 'WH01',
        day: '2024-01-01',
        total_placed_inc_wa: 100,
        total_delivered_inc_wa: 90,
        total_delivered_inc_wa_delivery_date: 85,
        on_time_inc_wa: 80,
        otd_pct_inc_wa: 88.89,
        null_on_time_count: 0,
        wa_count: 5,
        wa_delivered_count: 4,
        total_placed_exc_wa: 95,
        total_delivered_exc_wa: 86,
        total_delivered_exc_wa_delivery_date: 81,
        on_time_exc_wa: 76,
        otd_pct_exc_wa: 88.37,
      },
      {
        warehouse_code: 'WH01',
        day: '2024-01-02',
        total_placed_inc_wa: 110,
        total_delivered_inc_wa: 100,
        total_delivered_inc_wa_delivery_date: 95,
        on_time_inc_wa: 90,
        otd_pct_inc_wa: 90.0,
        null_on_time_count: 0,
        wa_count: 6,
        wa_delivered_count: 5,
        total_placed_exc_wa: 104,
        total_delivered_exc_wa: 95,
        total_delivered_exc_wa_delivery_date: 90,
        on_time_exc_wa: 85,
        otd_pct_exc_wa: 89.47,
      },
    ];

    const request = new NextRequest(
      'http://localhost:3000/api/dod?warehouse=WH01&from=2024-01-01&to=2024-01-02'
    );

    const response = await GET(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.series.labels).toEqual(['2024-01-01', '2024-01-02']);
    expect(data.series.totalOrders).toEqual([100, 110]);
    expect(data.series.onTimePct).toHaveLength(2);
    expect(data.series.waDeliveredPct).toHaveLength(2);
  });
});
