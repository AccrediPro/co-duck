import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { coachingStreaks, coachProfiles, bookings, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/streaks/clients
 *
 * Returns streaks for all clients who have bookings with this coach.
 * Coach auth required (must have coach_profiles).
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'streaks-clients');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Verify coach status
    const coachProfile = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, userId),
      columns: { userId: true },
    });

    if (!coachProfile) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can access client streaks' },
        },
        { status: 403 }
      );
    }

    // Get distinct client IDs from bookings
    const clientBookings = await db
      .select({ clientId: bookings.clientId })
      .from(bookings)
      .where(eq(bookings.coachId, userId));

    const clientIds = Array.from(new Set(clientBookings.map((b) => b.clientId)));

    if (clientIds.length === 0) {
      return Response.json({ success: true, data: [] });
    }

    // Get streaks for these clients
    const streaks = await db
      .select()
      .from(coachingStreaks)
      .where(inArray(coachingStreaks.userId, clientIds));

    const streakMap = new Map(streaks.map((s) => [s.userId, s]));

    // Get user info
    const clientUsers = await db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, clientIds));

    const data = clientUsers.map((client) => {
      const streak = streakMap.get(client.id);
      return {
        userId: client.id,
        name: client.name,
        avatar: client.avatarUrl,
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        isAtRisk: streak?.isAtRisk ?? false,
        lastActivityAt: streak?.lastActivityAt ?? null,
      };
    });

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching client streaks:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch client streaks' },
      },
      { status: 500 }
    );
  }
}
