import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { weeklyCheckIns, coachProfiles } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/check-ins/client/[userId]
 *
 * Coach endpoint: timeline of a single client's check-ins with this coach.
 * Query: ?limit=20
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'checkins-client-timeline');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId: coachUserId } = await auth();
  if (!coachUserId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Verify coach
    const coach = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, coachUserId),
      columns: { userId: true },
    });

    if (!coach) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can access this endpoint' } },
        { status: 403 }
      );
    }

    const { userId: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 52);

    const timeline = await db
      .select({
        id: weeklyCheckIns.id,
        mood: weeklyCheckIns.mood,
        note: weeklyCheckIns.note,
        weekNumber: weeklyCheckIns.weekNumber,
        weekYear: weeklyCheckIns.weekYear,
        respondedAt: weeklyCheckIns.respondedAt,
        promptedAt: weeklyCheckIns.promptedAt,
      })
      .from(weeklyCheckIns)
      .where(
        and(
          eq(weeklyCheckIns.userId, clientId),
          eq(weeklyCheckIns.coachId, coachUserId)
        )
      )
      .orderBy(desc(weeklyCheckIns.weekYear), desc(weeklyCheckIns.weekNumber))
      .limit(limit);

    return Response.json({ success: true, data: timeline });
  } catch (error) {
    console.error('[check-ins/client/[userId]] Error:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch client check-in timeline' } },
      { status: 500 }
    );
  }
}
