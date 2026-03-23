import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { coachingStreaks, streakActivities } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

function getISOWeek(date: Date): { weekNumber: number; weekYear: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekNumber, weekYear: d.getUTCFullYear() };
}

/**
 * GET /api/streaks/me
 *
 * Returns current user's streak data + this week's activities.
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'streaks-me');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const streak = await db.query.coachingStreaks.findFirst({
      where: eq(coachingStreaks.userId, userId),
    });

    if (!streak) {
      return Response.json({
        success: true,
        data: {
          currentStreak: 0,
          longestStreak: 0,
          isAtRisk: false,
          lastActivityAt: null,
          streakStartedAt: null,
          thisWeekActivities: [],
        },
      });
    }

    const now = new Date();
    const { weekNumber, weekYear } = getISOWeek(now);

    const activities = await db
      .select({
        actionType: streakActivities.actionType,
        createdAt: streakActivities.createdAt,
      })
      .from(streakActivities)
      .where(
        and(
          eq(streakActivities.userId, userId),
          eq(streakActivities.weekNumber, weekNumber),
          eq(streakActivities.weekYear, weekYear)
        )
      );

    return Response.json({
      success: true,
      data: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        isAtRisk: streak.isAtRisk,
        lastActivityAt: streak.lastActivityAt,
        streakStartedAt: streak.streakStartedAt,
        thisWeekActivities: activities.map((a) => ({
          type: a.actionType,
          at: a.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching streak:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch streak data' } },
      { status: 500 }
    );
  }
}
