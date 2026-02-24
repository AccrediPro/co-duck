/**
 * @fileoverview Group Session Participants API
 *
 * Join and leave group coaching sessions.
 *
 * @module api/group-sessions/[id]/participants
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { groupSessions, groupSessionParticipants, users } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/group-sessions/:id/participants
 *
 * Register (join) a group session as a client.
 * Creates a participant record and increments the count.
 *
 * @returns Participant registration record
 */
export async function POST(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'group-sessions-join');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const sessionId = parseInt(id);

    if (isNaN(sessionId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid session ID' } },
        { status: 400 }
      );
    }

    const session = await db.query.groupSessions.findFirst({
      where: eq(groupSessions.id, sessionId),
    });

    if (!session) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group session not found' } },
        { status: 404 }
      );
    }

    // Can't join own session
    if (session.coachId === userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Coach cannot join their own session' },
        },
        { status: 403 }
      );
    }

    // Must be published or full check
    if (session.status !== 'published') {
      return Response.json(
        {
          success: false,
          error: { code: 'NOT_AVAILABLE', message: 'This session is not open for registration' },
        },
        { status: 400 }
      );
    }

    // Check capacity
    if (session.participantCount >= session.maxParticipants) {
      return Response.json(
        { success: false, error: { code: 'SESSION_FULL', message: 'This session is full' } },
        { status: 400 }
      );
    }

    // Check if already registered
    const existing = await db.query.groupSessionParticipants.findFirst({
      where: and(
        eq(groupSessionParticipants.groupSessionId, sessionId),
        eq(groupSessionParticipants.clientId, userId),
        eq(groupSessionParticipants.status, 'registered')
      ),
    });

    if (existing) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'ALREADY_REGISTERED',
            message: 'You are already registered for this session',
          },
        },
        { status: 409 }
      );
    }

    // Register participant and update count atomically
    const [participant] = await db
      .insert(groupSessionParticipants)
      .values({
        groupSessionId: sessionId,
        clientId: userId,
        status: 'registered',
        amountPaidCents: session.priceCents,
      })
      .returning();

    // Increment participant count
    await db
      .update(groupSessions)
      .set({
        participantCount: sql`${groupSessions.participantCount} + 1`,
        status: session.participantCount + 1 >= session.maxParticipants ? 'full' : session.status,
      })
      .where(eq(groupSessions.id, sessionId));

    // Notify the coach
    const client = await db.query.users.findFirst({ where: eq(users.id, userId) });
    createNotification({
      userId: session.coachId,
      type: 'booking_confirmed',
      title: 'New group session registration',
      body: `${client?.name || 'A client'} registered for "${session.title}"`,
      link: `/dashboard/group-sessions/${sessionId}`,
    });

    return Response.json({
      success: true,
      data: {
        id: participant.id,
        groupSessionId: participant.groupSessionId,
        status: participant.status,
        registeredAt: participant.registeredAt,
      },
    });
  } catch (error) {
    console.error('Error joining group session:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to join group session' },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/group-sessions/:id/participants
 *
 * Cancel registration (leave) a group session.
 *
 * @returns Success confirmation
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'group-sessions-leave');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const sessionId = parseInt(id);

    if (isNaN(sessionId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid session ID' } },
        { status: 400 }
      );
    }

    // Find registration
    const registration = await db.query.groupSessionParticipants.findFirst({
      where: and(
        eq(groupSessionParticipants.groupSessionId, sessionId),
        eq(groupSessionParticipants.clientId, userId),
        eq(groupSessionParticipants.status, 'registered')
      ),
    });

    if (!registration) {
      return Response.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'You are not registered for this session' },
        },
        { status: 404 }
      );
    }

    // Update participant status to cancelled
    await db
      .update(groupSessionParticipants)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
      })
      .where(eq(groupSessionParticipants.id, registration.id));

    // Decrement participant count and potentially reopen
    const session = await db.query.groupSessions.findFirst({
      where: eq(groupSessions.id, sessionId),
    });

    if (session) {
      const newCount = Math.max(0, session.participantCount - 1);
      await db
        .update(groupSessions)
        .set({
          participantCount: newCount,
          status: session.status === 'full' ? 'published' : session.status,
        })
        .where(eq(groupSessions.id, sessionId));

      // Notify the coach
      const client = await db.query.users.findFirst({ where: eq(users.id, userId) });
      createNotification({
        userId: session.coachId,
        type: 'booking_cancelled',
        title: 'Group session cancellation',
        body: `${client?.name || 'A client'} cancelled their registration for "${session.title}"`,
        link: `/dashboard/group-sessions/${sessionId}`,
      });
    }

    return Response.json({
      success: true,
      data: { message: 'Registration cancelled successfully' },
    });
  } catch (error) {
    console.error('Error leaving group session:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to leave group session' },
      },
      { status: 500 }
    );
  }
}
