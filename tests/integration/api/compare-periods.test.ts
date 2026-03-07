import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/compare-periods/route';

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn(() => ({
            data: mockData,
            error: mockError,
          })),
        })),
      })),
    })),
  })),
}));

// Mock rate limiting middleware
vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));

let mockData: unknown[] | null = null;
let mockError: { message: string } | null = null;

describe('Compare Periods API Integration Tests', () => {
  beforeEach(() => {
    mockData = null;
    mockError = null;
    vi.clearAllMocks();
  });

  it('should successfully compare two periods with valid data', async () => {
    // Mock successful database response
    mockData = [
      {
        created_date_local: '2024-01-01',
        parcel_id: '1',
        is_on_time: true,
        delivered_ts: '2024-01-02T10:00:00Z',
        delivery_date_local: '2024-01-02',
        is_countable_order: true,
        is_delivered_status: true,
        order_ts_utc: '2024-01-01T08:00:00Z',
        waiting_address: false,
      },
      {
        created_date_local: '2024-02-01',
        parcel_id: '2',
        is_on_time: false,
        delivered_ts: '2024-02-03T10:00:00Z',
        delivery_date_local: '2024-02-03',
        is_countable_order: true,
        is_delivered_status: true,
        order_ts_utc: '2024-02-01T08:00:00Z',
        waiting_address: false,
      },
    ];

    const request = new NextRequest('http://localhost:3000/api/compare-periods', {
      method: 'POST',
      body: JSON.stringify({
        warehouse: 'WH01',
        period_a_start: '2024-01-01',
        period_a_end: '2024-01-31',
        period_b_start: '2024-02-01',
        period_b_end: '2024-02-28',
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('period_a');
    expect(data).toHaveProperty('period_b');
    expect(data).toHaveProperty('comparison');
    expect(data.period_a).toHaveProperty('total_placed');
    expect(data.period_b).toHaveProperty('total_placed');
    expect(data.comparison).toHaveProperty('total_placed');
  });

  it('should return 400 when warehouse is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/compare-periods', {
      method: 'POST',
      body: JSON.stringify({
        period_a_start: '2024-01-01',
        period_a_end: '2024-01-31',
        period_b_start: '2024-02-01',
        period_b_end: '2024-02-28',
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('All fields required');
  });

  it('should return 400 when period dates are missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/compare-periods', {
      method: 'POST',
      body: JSON.stringify({
        warehouse: 'WH01',
        period_a_start: '2024-01-01',
        // Missing other dates
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('All fields required');
  });

  it('should return 400 when request body is invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/compare-periods', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('should return 500 when database query fails', async () => {
    mockError = new Error('Database connection failed');

    const request = new NextRequest('http://localhost:3000/api/compare-periods', {
      method: 'POST',
      body: JSON.stringify({
        warehouse: 'WH01',
        period_a_start: '2024-01-01',
        period_a_end: '2024-01-31',
        period_b_start: '2024-02-01',
        period_b_end: '2024-02-28',
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Database connection failed');
  });

  it('should handle empty data from database', async () => {
    mockData = [];

    const request = new NextRequest('http://localhost:3000/api/compare-periods', {
      method: 'POST',
      body: JSON.stringify({
        warehouse: 'WH01',
        period_a_start: '2024-01-01',
        period_a_end: '2024-01-31',
        period_b_start: '2024-02-01',
        period_b_end: '2024-02-28',
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.period_a.total_placed).toBe(0);
    expect(data.period_b.total_placed).toBe(0);
  });

  it('should normalize warehouse code to uppercase', async () => {
    mockData = [];

    const request = new NextRequest('http://localhost:3000/api/compare-periods', {
      method: 'POST',
      body: JSON.stringify({
        warehouse: 'wh01', // lowercase
        period_a_start: '2024-01-01',
        period_a_end: '2024-01-31',
        period_b_start: '2024-02-01',
        period_b_end: '2024-02-28',
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);

    expect(response.status).toBe(200);
  });
});
