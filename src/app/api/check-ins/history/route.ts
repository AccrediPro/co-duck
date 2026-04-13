import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { weeklyCheckIns } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/check-ins/history
 *
 * Returns past check-ins for the authenticated client, ordered by week DESC.
 * Query: ?coachId=xxx&limit=12
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'checkins-history');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '12', 10) || 12, 1), 52);

    const conditions = [eq(weeklyCheckIns.userId, userId)];
    if (coachId) {
      conditions.push(eq(weeklyCheckIns.coachId, coachId));
    }

    const history = await db
      .select({
        id: weeklyCheckIns.id,
        mood: weeklyCheckIns.mood,
        note: weeklyCheckIns.note,
        weekNumber: weeklyCheckIns.weekNumber,
        weekYear: weeklyCheckIns.weekYear,
        respondedAt: weeklyCheckIns.respondedAt,
      })
      .from(weeklyCheckIns)
      .where(and(...conditions))
      .orderBy(desc(weeklyCheckIns.weekYear), desc(weeklyCheckIns.weekNumber))
      .limit(limit);

    return Response.json({ success: true, data: history });
  } catch (error) {
    console.error('[check-ins/history] Error:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch check-in history' },
      },
      { status: 500 }
    );
  }
}
