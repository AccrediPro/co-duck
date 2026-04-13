import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sessionPrepResponses, sessionPrepQuestions, bookings, users } from '@/db/schema';
import { eq, and, isNull, gte } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/session-prep/pending
 *
 * Returns pending prep for the user's next upcoming session (where completedAt is null).
 * Client auth required.
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'session-prep-pending');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    // Find pending prep for the user's next upcoming session
    const pendingPrep = await db
      .select({
        id: sessionPrepResponses.id,
        bookingId: sessionPrepResponses.bookingId,
        coachId: sessionPrepResponses.coachId,
        promptedAt: sessionPrepResponses.promptedAt,
        booking: {
          startTime: bookings.startTime,
        },
        coach: {
          name: users.name,
        },
      })
      .from(sessionPrepResponses)
      .innerJoin(bookings, eq(sessionPrepResponses.bookingId, bookings.id))
      .innerJoin(users, eq(sessionPrepResponses.coachId, users.id))
      .where(
        and(
          eq(sessionPrepResponses.userId, userId),
          isNull(sessionPrepResponses.completedAt),
          gte(bookings.startTime, now)
        )
      )
      .orderBy(bookings.startTime)
      .limit(1);

    if (pendingPrep.length === 0) {
      return Response.json({ success: true, data: null });
    }

    const prep = pendingPrep[0];

    // Get coach's custom questions or defaults
    const coachQuestions = await db
      .select({ questions: sessionPrepQuestions.questions })
      .from(sessionPrepQuestions)
      .where(eq(sessionPrepQuestions.coachId, prep.coachId))
      .limit(1);

    let questions: string[];
    if (coachQuestions.length > 0) {
      questions = coachQuestions[0].questions;
    } else {
      // Fall back to default questions
      const defaultQuestions = await db
        .select({ questions: sessionPrepQuestions.questions })
        .from(sessionPrepQuestions)
        .where(and(isNull(sessionPrepQuestions.coachId), eq(sessionPrepQuestions.isDefault, true)))
        .limit(1);

      questions = defaultQuestions.length > 0 ? defaultQuestions[0].questions : [];
    }

    return Response.json({
      success: true,
      data: {
        id: prep.id,
        bookingId: prep.bookingId,
        coachName: prep.coach.name,
        sessionDate: prep.booking.startTime,
        questions,
        responses: null,
        promptedAt: prep.promptedAt,
      },
    });
  } catch (error) {
    console.error('[SessionPrep] Error fetching pending prep:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch pending prep' },
      },
      { status: 500 }
    );
  }
}
