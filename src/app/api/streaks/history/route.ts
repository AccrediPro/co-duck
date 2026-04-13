import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { streakActivities } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

function getISOWeek(date: Date): { weekNumber: number; weekYear: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekNumber, weekYear: d.getUTCFullYear() };
}

function getPreviousISOWeek(
  weekNumber: number,
  weekYear: number
): { weekNumber: number; weekYear: number } {
  if (weekNumber > 1) {
    return { weekNumber: weekNumber - 1, weekYear };
  }
  const dec31 = new Date(Date.UTC(weekYear - 1, 11, 31));
  const { weekNumber: lastWeek } = getISOWeek(dec31);
  return { weekNumber: lastWeek, weekYear: weekYear - 1 };
}

/**
 * GET /api/streaks/history
 *
 * Returns weekly activity summary for last N weeks.
 * Query: ?weeks=12 (default 12, max 52)
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'streaks-history');
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
    const weeks = Math.min(52, Math.max(1, parseInt(searchParams.get('weeks') || '12')));

    // Calculate the week range
    const now = new Date();
    let { weekNumber, weekYear } = getISOWeek(now);

    const weekKeys: { weekNumber: number; weekYear: number }[] = [];
    for (let i = 0; i < weeks; i++) {
      weekKeys.push({ weekNumber, weekYear });
      const prev = getPreviousISOWeek(weekNumber, weekYear);
      weekNumber = prev.weekNumber;
      weekYear = prev.weekYear;
    }

    // Get all activities for this user
    const allActivities = await db
      .select({
        actionType: streakActivities.actionType,
        createdAt: streakActivities.createdAt,
        weekNumber: streakActivities.weekNumber,
        weekYear: streakActivities.weekYear,
      })
      .from(streakActivities)
      .where(eq(streakActivities.userId, userId))
      .orderBy(desc(streakActivities.createdAt));

    // Group by week
    const activityMap = new Map<string, { type: string; at: Date }[]>();
    for (const a of allActivities) {
      const key = `${a.weekYear}-${a.weekNumber}`;
      if (!activityMap.has(key)) activityMap.set(key, []);
      activityMap.get(key)!.push({ type: a.actionType, at: a.createdAt });
    }

    const data = weekKeys.map((wk) => {
      const key = `${wk.weekYear}-${wk.weekNumber}`;
      const activities = activityMap.get(key) || [];
      return {
        weekNumber: wk.weekNumber,
        weekYear: wk.weekYear,
        activities,
        hasActivity: activities.length > 0,
      };
    });

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching streak history:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch streak history' },
      },
      { status: 500 }
    );
  }
}
