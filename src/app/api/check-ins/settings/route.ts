import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { weeklyCheckIns, coachProfiles } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * PATCH /api/check-ins/settings
 *
 * Coach endpoint: update the checkInDay for a client's future check-ins.
 * Body: { clientId: string, checkInDay: number } (0=Sun..6=Sat)
 */
export async function PATCH(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'checkins-settings');
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
          error: { code: 'FORBIDDEN', message: 'Only coaches can update check-in settings' },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clientId, checkInDay } = body as { clientId?: string; checkInDay?: number };

    if (!clientId || typeof clientId !== 'string') {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'clientId is required' } },
        { status: 400 }
      );
    }

    if (
      checkInDay === undefined ||
      typeof checkInDay !== 'number' ||
      checkInDay < 0 ||
      checkInDay > 6
    ) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_DAY', message: 'checkInDay must be 0 (Sun) through 6 (Sat)' },
        },
        { status: 400 }
      );
    }

    // Update checkInDay on the most recent check-in row for this coach-client pair.
    // The CRON reads checkInDay from the latest row to determine when to prompt.
    // If no rows exist yet, the setting will take effect when the first check-in is created.
    const latestCheckIn = await db
      .select({ id: weeklyCheckIns.id })
      .from(weeklyCheckIns)
      .where(and(eq(weeklyCheckIns.coachId, userId), eq(weeklyCheckIns.userId, clientId)))
      .orderBy(desc(weeklyCheckIns.weekYear), desc(weeklyCheckIns.weekNumber))
      .limit(1);

    if (latestCheckIn.length > 0) {
      await db
        .update(weeklyCheckIns)
        .set({ checkInDay })
        .where(eq(weeklyCheckIns.id, latestCheckIn[0].id));
    }

    return Response.json({
      success: true,
      data: { clientId, checkInDay },
    });
  } catch (error) {
    console.error('[check-ins/settings] Error:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update check-in settings' },
      },
      { status: 500 }
    );
  }
}
