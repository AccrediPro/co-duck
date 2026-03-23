import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { weeklyCheckIns, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { recordStreakActivity } from '@/lib/streaks';
import { createNotification } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/push-notifications';
import { getSocketServer } from '@/lib/socket-server';

const VALID_MOODS = ['good', 'okay', 'struggling'] as const;
type Mood = (typeof VALID_MOODS)[number];

/**
 * POST /api/check-ins/respond
 *
 * Submit a mood response to a pending check-in.
 * Side effects: streak recording, struggling notification to coach, socket event.
 */
export async function POST(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'checkins-respond');
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
    const { checkInId, mood, note } = body as {
      checkInId?: number;
      mood?: string;
      note?: string;
    };

    if (!checkInId || typeof checkInId !== 'number') {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'checkInId is required' } },
        { status: 400 }
      );
    }

    if (!mood || !VALID_MOODS.includes(mood as Mood)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_MOOD', message: 'mood must be one of: good, okay, struggling' } },
        { status: 400 }
      );
    }

    if (note !== undefined && note !== null && typeof note === 'string' && note.length > 280) {
      return Response.json(
        { success: false, error: { code: 'NOTE_TOO_LONG', message: 'note must be 280 characters or less' } },
        { status: 400 }
      );
    }

    // Verify check-in belongs to this user and is not yet responded
    const existing = await db.query.weeklyCheckIns.findFirst({
      where: and(
        eq(weeklyCheckIns.id, checkInId),
        eq(weeklyCheckIns.userId, userId)
      ),
    });

    if (!existing) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Check-in not found' } },
        { status: 404 }
      );
    }

    if (existing.respondedAt) {
      return Response.json(
        { success: false, error: { code: 'ALREADY_RESPONDED', message: 'This check-in has already been answered' } },
        { status: 409 }
      );
    }

    // Update the check-in
    const now = new Date();
    const [updated] = await db
      .update(weeklyCheckIns)
      .set({
        mood: mood as Mood,
        note: typeof note === 'string' ? note.trim() || null : null,
        respondedAt: now,
      })
      .where(eq(weeklyCheckIns.id, checkInId))
      .returning();

    // Fire-and-forget: record streak activity
    recordStreakActivity(userId, 'check_in_completed', String(checkInId)).catch((err) =>
      console.error('[check-ins/respond] Streak recording failed:', err)
    );

    // If mood is 'struggling', notify the coach
    if (mood === 'struggling') {
      const client = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { name: true },
      });

      const clientName = client?.name || 'Un tuo cliente';

      createNotification({
        userId: existing.coachId,
        type: 'system',
        title: 'Un tuo cliente ha bisogno di te',
        body: `${clientName} ha indicato di essere in difficoltà nel check-in settimanale.`,
        link: '/dashboard/clients',
      });

      sendPushNotification(existing.coachId, {
        title: 'Un tuo cliente ha bisogno di te',
        body: `${clientName} ha indicato di essere in difficoltà nel check-in settimanale.`,
        data: {
          type: 'check_in_struggling',
          link: '/dashboard/clients',
        },
      });
    }

    // Emit checkin:received via Socket.io to coach's personal room
    try {
      const io = getSocketServer();
      if (io) {
        io.to(`user:${existing.coachId}`).emit('checkin:received', {
          userId,
          mood: updated.mood,
          note: updated.note,
          weekNumber: updated.weekNumber,
        });
      }
    } catch {
      // Fire-and-forget
    }

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        mood: updated.mood,
        note: updated.note,
        respondedAt: updated.respondedAt,
      },
    });
  } catch (error) {
    console.error('[check-ins/respond] Error:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to respond to check-in' } },
      { status: 500 }
    );
  }
}
