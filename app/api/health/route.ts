import { NextResponse } from 'next/server';

import { getSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const startTime = Date.now();
  const version = process.env.npm_package_version || '0.1.0';

  try {
    // Check database connectivity with a simple query
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from('parcel_logs').select('id').limit(1);

    if (error) {
      const responseTime = Date.now() - startTime;
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          version,
          responseTime,
          database: 'unreachable',
          error: error.message,
        },
        { status: 503 }
      );
    }

    const responseTime = Date.now() - startTime;
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version,
        responseTime,
        database: 'connected',
      },
      { status: 200 }
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version,
        responseTime,
        database: 'unreachable',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
