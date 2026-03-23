import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sessionPrepResponses, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { createNotification } from '@/lib/notifications';
import { getSocketServer } from '@/lib/socket-server';
import { recordStreakActivity } from '@/lib/streaks';

/**
 * POST /api/session-prep/respond
 *
 * Submit client's prep responses for an upcoming session.
 * Client auth required.
 */
export async function POST(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'session-prep-respond');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { prepId, responses } = body;

    if (!prepId || !Array.isArray(responses) || responses.length === 0) {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'prepId and responses array are required' } },
        { status: 400 }
      );
    }

    // Validate each response has question + answer
    for (const r of responses) {
      if (typeof r.question !== 'string' || typeof r.answer !== 'string' || !r.question.trim() || !r.answer.trim()) {
        return Response.json(
          { success: false, error: { code: 'INVALID_RESPONSE', message: 'Each response must have a non-empty question and answer' } },
          { status: 400 }
        );
      }
    }

    // Find the prep record — must belong to this user and not already completed
    const prep = await db.query.sessionPrepResponses.findFirst({
      where: and(
        eq(sessionPrepResponses.id, prepId),
        eq(sessionPrepResponses.userId, userId),
        isNull(sessionPrepResponses.completedAt)
      ),
    });

    if (!prep) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pending prep not found or already completed' } },
        { status: 404 }
      );
    }

    const now = new Date();

    // Update with responses
    const [updated] = await db
      .update(sessionPrepResponses)
      .set({
        responses: responses.map((r: { question: string; answer: string }) => ({
          question: r.question.trim(),
          answer: r.answer.trim(),
        })),
        completedAt: now,
      })
      .where(eq(sessionPrepResponses.id, prepId))
      .returning();

    // Fire-and-forget: record streak activity
    recordStreakActivity(userId, 'session_prep_completed', String(prepId)).catch((err) => {
      console.error('[SessionPrep] Failed to record streak activity:', err);
    });

    // Get client name for notification
    const clientUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true },
    });

    // Send push notification to coach
    createNotification({
      userId: prep.coachId,
      type: 'system',
      title: 'Session prep received',
      body: `${clientUser?.name || 'A client'} has completed their session prep for tomorrow`,
      link: `/dashboard/sessions`,
    });

    // Emit Socket.io event to coach
    try {
      const io = getSocketServer();
      if (io) {
        io.to(`user:${prep.coachId}`).emit('sessionprep:received', {
          bookingId: prep.bookingId,
          userId,
          completedAt: now,
        });
      }
    } catch {
      // Fire-and-forget
    }

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        responses: updated.responses,
        completedAt: updated.completedAt,
      },
    });
  } catch (error) {
    console.error('[SessionPrep] Error submitting responses:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit responses' } },
      { status: 500 }
    );
  }
}
