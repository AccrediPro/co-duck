import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sessionPrepResponses, coachProfiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * PATCH /api/session-prep/[id]/viewed
 *
 * Marks a session prep response as viewed by coach.
 * Coach auth required.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = rateLimit(request, WRITE_LIMIT, 'session-prep-viewed');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Verify user is a coach
    const coachProfile = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, userId),
      columns: { userId: true },
    });

    if (!coachProfile) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can access this endpoint' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const prepId = parseInt(id, 10);

    if (isNaN(prepId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'Invalid prep id' } },
        { status: 400 }
      );
    }

    // Find the prep record — must belong to this coach
    const prep = await db.query.sessionPrepResponses.findFirst({
      where: and(
        eq(sessionPrepResponses.id, prepId),
        eq(sessionPrepResponses.coachId, userId)
      ),
      columns: { id: true },
    });

    if (!prep) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Prep response not found' } },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(sessionPrepResponses)
      .set({ viewedByCoach: true })
      .where(eq(sessionPrepResponses.id, prepId))
      .returning({ id: sessionPrepResponses.id, viewedByCoach: sessionPrepResponses.viewedByCoach });

    return Response.json({
      success: true,
      data: { id: updated.id, viewedByCoach: updated.viewedByCoach },
    });
  } catch (error) {
    console.error('[SessionPrep] Error marking as viewed:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark as viewed' } },
      { status: 500 }
    );
  }
}
