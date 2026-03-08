import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ingest/route';

// Mock the Supabase client
let mockWarehouseData: { id: number; code: string } | null = null;
let mockWarehouseError: Error | null = null;
let mockUpsertData: unknown | null = null;
let mockUpsertError: Error | null = null;
let mockUpsertCount: number | null = null;
let mockIngestRunData: { id: string } | null = null;
let mockIngestRunError: Error | null = null;

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'warehouses') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => ({
                data: mockWarehouseData,
                error: mockWarehouseError,
              })),
            })),
          })),
        };
      }
      if (table === 'ingest_runs') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(() => ({
                data: mockIngestRunData,
                error: mockIngestRunError,
              })),
            })),
          })),
        };
      }
      // Default for data tables (delivery_details, parcel_logs, etc.)
      return {
        upsert: vi.fn(() => ({
          data: mockUpsertData,
          error: mockUpsertError,
          count: mockUpsertCount,
        })),
      };
    }),
  })),
}));

// Mock rate limiting middleware
vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: (handler: (request: Request) => Promise<Response>) => handler,
}));

describe('Upload Workflow Integration Tests', () => {
  beforeEach(() => {
    mockWarehouseData = { id: 1, code: 'WH01' };
    mockWarehouseError = null;
    mockUpsertData = null;
    mockUpsertError = null;
    mockUpsertCount = 0;
    mockIngestRunData = { id: 'run-123' };
    mockIngestRunError = null;
    vi.clearAllMocks();
  });

  it('should successfully upload delivery_details data', async () => {
    mockUpsertCount = 2;

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        warehouseCode: 'WH01',
        datasetType: 'delivery_details',
        rows: [
          { parcel_id: 'P001', status: 'delivered' },
          { parcel_id: 'P002', status: 'in_transit' },
        ],
        fileName: 'test-upload.csv',
        parsedCount: 2,
        warningCount: 0,
        errorCount: 0,
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('warehouseCode', 'WH01');
    expect(data).toHaveProperty('datasetType', 'delivery_details');
    expect(data).toHaveProperty('insertedCount', 2);
    expect(data).toHaveProperty('ignoredCount', 0);
    expect(data).toHaveProperty('ingestRunId');
  });

  it('should return 400 when warehouseCode is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        datasetType: 'delivery_details',
        rows: [{ parcel_id: 'P001' }],
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('warehouseCode is required');
  });

  it('should return 400 when datasetType is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        warehouseCode: 'WH01',
        datasetType: 'invalid_type',
        rows: [{ parcel_id: 'P001' }],
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('datasetType is invalid');
  });

  it('should return 400 when rows array is empty', async () => {
    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        warehouseCode: 'WH01',
        datasetType: 'delivery_details',
        rows: [],
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('rows must be a non-empty array');
  });

  it('should return 400 when warehouse code is unknown', async () => {
    mockWarehouseData = null;

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        warehouseCode: 'UNKNOWN',
        datasetType: 'delivery_details',
        rows: [{ parcel_id: 'P001' }],
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Unknown warehouse code');
  });

  it('should return 500 when warehouse lookup fails', async () => {
    mockWarehouseError = new Error('Database connection failed');

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        warehouseCode: 'WH01',
        datasetType: 'delivery_details',
        rows: [{ parcel_id: 'P001' }],
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
  });

  it('should return 500 when data upsert fails', async () => {
    mockUpsertError = new Error('Upsert failed');

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        warehouseCode: 'WH01',
        datasetType: 'delivery_details',
        rows: [{ parcel_id: 'P001' }],
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Upsert failed');
  });

  it('should handle partial success with errors', async () => {
    mockUpsertCount = 1;

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        warehouseCode: 'WH01',
        datasetType: 'delivery_details',
        rows: [{ parcel_id: 'P001' }],
        parsedCount: 2,
        errorCount: 1,
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.insertedCount).toBe(1);
    expect(data.errorCount).toBe(1);
  });

  it('should handle duplicate rows (ignored count)', async () => {
    mockUpsertCount = 1; // Only 1 inserted out of 3

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        warehouseCode: 'WH01',
        datasetType: 'delivery_details',
        rows: [
          { parcel_id: 'P001' },
          { parcel_id: 'P001' }, // duplicate
          { parcel_id: 'P001' }, // duplicate
        ],
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.insertedCount).toBe(1);
    expect(data.ignoredCount).toBe(2);
  });

  it('should normalize warehouse code to uppercase', async () => {
    mockUpsertCount = 1;

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        warehouseCode: 'wh01', // lowercase
        datasetType: 'delivery_details',
        rows: [{ parcel_id: 'P001' }],
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.warehouseCode).toBe('WH01');
  });

  it('should handle all supported dataset types', async () => {
    const datasetTypes = [
      'delivery_details',
      'parcel_logs',
      'items_per_order',
      'collectors_report',
      'prepare_report',
      'freshdesk_tickets',
      'wa_orders',
      'delivery_timing_rules',
    ];

    for (const datasetType of datasetTypes) {
      mockUpsertCount = 1;

      const request = new NextRequest('http://localhost:3000/api/ingest', {
        method: 'POST',
        body: JSON.stringify({
          warehouseCode: 'WH01',
          datasetType,
          rows: [{ test_field: 'value' }],
        }),
      });

      const response = await POST(request, {} as Record<string, unknown>);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.datasetType).toBe(datasetType);
    }
  });

  it('should continue even if ingest_runs logging fails', async () => {
    mockUpsertCount = 1;
    mockIngestRunData = null; // Set to null when there's an error
    mockIngestRunError = new Error('Ingest runs table not available');

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({
        warehouseCode: 'WH01',
        datasetType: 'delivery_details',
        rows: [{ parcel_id: 'P001' }],
      }),
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.insertedCount).toBe(1);
    expect(data.ingestRunId).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('should handle invalid JSON in request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(request, {} as Record<string, unknown>);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });
});
