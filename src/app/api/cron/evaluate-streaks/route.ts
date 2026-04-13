import { NextResponse } from 'next/server';
import { evaluateStreaks } from '@/lib/streaks';

function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[evaluate-streaks] CRON_SECRET is not configured');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  return token === cronSecret;
}

/**
 * POST /api/cron/evaluate-streaks
 *
 * Daily CRON job to evaluate coaching streaks.
 * Increments/resets streaks based on weekly activity.
 * Protected by CRON_SECRET.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await evaluateStreaks();

    console.log(`[evaluate-streaks] CRON completed:`, results);

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[evaluate-streaks] CRON error:', errorMessage);

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
