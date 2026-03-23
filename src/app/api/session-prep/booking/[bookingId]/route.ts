import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sessionPrepResponses, bookings, users, coachProfiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/session-prep/booking/[bookingId]
 *
 * View client's prep for a specific booking. Coach auth required.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'session-prep-booking');
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

    const { bookingId } = await params;
    const bookingIdNum = parseInt(bookingId, 10);

    if (isNaN(bookingIdNum)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'Invalid bookingId' } },
        { status: 400 }
      );
    }

    // Verify this booking belongs to this coach
    const booking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.id, bookingIdNum),
        eq(bookings.coachId, userId)
      ),
      columns: { id: true },
    });

    if (!booking) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Get prep responses for this booking
    const prep = await db
      .select({
        id: sessionPrepResponses.id,
        bookingId: sessionPrepResponses.bookingId,
        userId: sessionPrepResponses.userId,
        responses: sessionPrepResponses.responses,
        promptedAt: sessionPrepResponses.promptedAt,
        completedAt: sessionPrepResponses.completedAt,
        viewedByCoach: sessionPrepResponses.viewedByCoach,
        client: {
          name: users.name,
        },
      })
      .from(sessionPrepResponses)
      .innerJoin(users, eq(sessionPrepResponses.userId, users.id))
      .where(eq(sessionPrepResponses.bookingId, bookingIdNum))
      .limit(1);

    if (prep.length === 0) {
      return Response.json({ success: true, data: null });
    }

    const row = prep[0];

    return Response.json({
      success: true,
      data: {
        id: row.id,
        bookingId: row.bookingId,
        userId: row.userId,
        clientName: row.client.name,
        responses: row.responses,
        promptedAt: row.promptedAt,
        completedAt: row.completedAt,
        viewedByCoach: row.viewedByCoach,
      },
    });
  } catch (error) {
    console.error('[SessionPrep] Error fetching booking prep:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch prep' } },
      { status: 500 }
    );
  }
}
