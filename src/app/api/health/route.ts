/**
 * @fileoverview Health Check API
 *
 * Returns platform health status including DB connectivity.
 *
 * @module api/health
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/health
 *
 * Returns service health status. No auth required.
 * Used by uptime monitors and deployment checks.
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'health');
  if (!rl.success) return rateLimitResponse(rl);

  const start = Date.now();
  let dbStatus: 'ok' | 'error' = 'error';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = 'ok';
  } catch {
    dbStatus = 'error';
  }

  const totalLatencyMs = Date.now() - start;
  const allHealthy = dbStatus === 'ok';

  return Response.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      latencyMs: totalLatencyMs,
      services: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
      },
    },
    { status: allHealthy ? 200 : 503 }
  );
}
