import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { weeklyCheckIns, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

function getISOWeek(date: Date): { weekNumber: number; weekYear: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekNumber, weekYear: d.getUTCFullYear() };
}

/**
 * GET /api/check-ins/pending
 *
 * Returns the pending check-in for this week (if any) — where respondedAt is null.
 * Query: ?coachId=xxx (optional)
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'checkins-pending');
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
    const { weekNumber, weekYear } = getISOWeek(new Date());

    const conditions = [
      eq(weeklyCheckIns.userId, userId),
      eq(weeklyCheckIns.weekNumber, weekNumber),
      eq(weeklyCheckIns.weekYear, weekYear),
      isNull(weeklyCheckIns.respondedAt),
    ];

    if (coachId) {
      conditions.push(eq(weeklyCheckIns.coachId, coachId));
    }

    const pending = await db
      .select({
        id: weeklyCheckIns.id,
        coachId: weeklyCheckIns.coachId,
        coachName: users.name,
        weekNumber: weeklyCheckIns.weekNumber,
        weekYear: weeklyCheckIns.weekYear,
        promptedAt: weeklyCheckIns.promptedAt,
      })
      .from(weeklyCheckIns)
      .innerJoin(users, eq(users.id, weeklyCheckIns.coachId))
      .where(and(...conditions))
      .limit(1);

    const row = pending[0];
    return Response.json({
      success: true,
      data: row ? { ...row, mood: null, note: null } : null,
    });
  } catch (error) {
    console.error('[check-ins/pending] Error:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch pending check-in' },
      },
      { status: 500 }
    );
  }
}
