import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { weeklyCheckIns, users, coachProfiles, coachingStreaks, conversations } from '@/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

function getISOWeek(date: Date): { weekNumber: number; weekYear: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekNumber, weekYear: d.getUTCFullYear() };
}

const MOOD_SORT_ORDER: Record<string, number> = {
  struggling: 0,
  okay: 1,
  good: 2,
};

/**
 * GET /api/check-ins/clients
 *
 * Coach endpoint: returns latest check-in for each client with conversations.
 * Sorted: 'struggling' first, then 'okay', then 'good', then no check-in.
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'checkins-clients');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Verify coach
    const coach = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, userId),
      columns: { userId: true },
    });

    if (!coach) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can access this endpoint' },
        },
        { status: 403 }
      );
    }

    const { weekNumber, weekYear } = getISOWeek(new Date());

    // Get all clients who have conversations with this coach
    const clientConversations = await db
      .select({
        clientId: conversations.clientId,
      })
      .from(conversations)
      .where(eq(conversations.coachId, userId));

    if (clientConversations.length === 0) {
      return Response.json({ success: true, data: [] });
    }

    const clientIds = clientConversations.map((c) => c.clientId);

    // Get latest check-in for each client (this week)
    const checkIns = await db
      .select({
        userId: weeklyCheckIns.userId,
        mood: weeklyCheckIns.mood,
        note: weeklyCheckIns.note,
        respondedAt: weeklyCheckIns.respondedAt,
        weekNumber: weeklyCheckIns.weekNumber,
      })
      .from(weeklyCheckIns)
      .where(
        and(
          eq(weeklyCheckIns.coachId, userId),
          eq(weeklyCheckIns.weekNumber, weekNumber),
          eq(weeklyCheckIns.weekYear, weekYear)
        )
      );

    const checkInByClient = new Map(checkIns.map((ci) => [ci.userId, ci]));

    // Get user info + streaks for all clients
    const clientsData = await db
      .select({
        userId: users.id,
        name: users.name,
        avatar: users.avatarUrl,
        currentStreak: coachingStreaks.currentStreak,
      })
      .from(users)
      .leftJoin(coachingStreaks, eq(coachingStreaks.userId, users.id))
      .where(
        sql`${users.id} IN (${sql.join(
          clientIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    // Build response with check-in data
    const result = clientsData.map((client) => {
      const checkIn = checkInByClient.get(client.userId);
      return {
        userId: client.userId,
        name: client.name,
        avatar: client.avatar,
        mood: checkIn?.respondedAt ? checkIn.mood : null,
        note: checkIn?.respondedAt ? checkIn.note : null,
        respondedAt: checkIn?.respondedAt ?? null,
        weekNumber: checkIn?.weekNumber ?? weekNumber,
        currentStreak: client.currentStreak ?? 0,
      };
    });

    // Sort: struggling first, then okay, then good, then no check-in
    result.sort((a, b) => {
      const aOrder = a.mood ? (MOOD_SORT_ORDER[a.mood] ?? 3) : 3;
      const bOrder = b.mood ? (MOOD_SORT_ORDER[b.mood] ?? 3) : 3;
      return aOrder - bOrder;
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('[check-ins/clients] Error:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch client check-ins' },
      },
      { status: 500 }
    );
  }
}
