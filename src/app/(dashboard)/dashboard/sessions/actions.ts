'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or, gte, lt, desc, asc, sql } from 'drizzle-orm';
import { db, bookings, users } from '@/db';
import type { BookingSessionType } from '@/db/schema';

export type SessionStatus = 'upcoming' | 'past' | 'cancelled';

export interface SessionWithClient {
  id: number;
  clientId: string;
  clientName: string | null;
  clientAvatar: string | null;
  clientEmail: string;
  sessionType: BookingSessionType;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  clientNotes: string | null;
  coachNotes: string | null;
  createdAt: Date;
}

export interface GetSessionsResult {
  success: boolean;
  sessions?: SessionWithClient[];
  totalCount?: number;
  error?: string;
}

export async function getCoachSessions(
  tab: SessionStatus,
  page: number = 1,
  perPage: number = 10
): Promise<GetSessionsResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const now = new Date();
  const offset = (page - 1) * perPage;

  try {
    // Build the status filter based on tab
    let statusCondition;
    let orderDirection: typeof desc | typeof asc = desc;

    if (tab === 'upcoming') {
      // Upcoming: future sessions with confirmed or pending status
      statusCondition = and(
        eq(bookings.coachId, userId),
        gte(bookings.startTime, now),
        or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'pending'))
      );
      orderDirection = asc; // Nearest session first
    } else if (tab === 'past') {
      // Past: sessions that already happened (completed, no_show, or confirmed but in past)
      statusCondition = and(
        eq(bookings.coachId, userId),
        lt(bookings.startTime, now),
        or(
          eq(bookings.status, 'completed'),
          eq(bookings.status, 'no_show'),
          eq(bookings.status, 'confirmed'),
          eq(bookings.status, 'pending')
        )
      );
      orderDirection = desc; // Most recent first
    } else {
      // Cancelled: all cancelled sessions
      statusCondition = and(eq(bookings.coachId, userId), eq(bookings.status, 'cancelled'));
      orderDirection = desc;
    }

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(statusCondition);

    const totalCount = countResult[0]?.count || 0;

    // Get sessions with client info
    const sessionsData = await db
      .select({
        id: bookings.id,
        clientId: bookings.clientId,
        clientName: users.name,
        clientAvatar: users.avatarUrl,
        clientEmail: users.email,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
        clientNotes: bookings.clientNotes,
        coachNotes: bookings.coachNotes,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.clientId, users.id))
      .where(statusCondition)
      .orderBy(orderDirection(bookings.startTime))
      .limit(perPage)
      .offset(offset);

    return {
      success: true,
      sessions: sessionsData,
      totalCount,
    };
  } catch {
    return { success: false, error: 'Failed to fetch sessions' };
  }
}

export interface MarkCompleteResult {
  success: boolean;
  error?: string;
}

export async function markSessionComplete(sessionId: number): Promise<MarkCompleteResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the session belongs to this coach and is in a valid state
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, sessionId), eq(bookings.coachId, userId)))
      .limit(1);

    if (existingBooking.length === 0) {
      return { success: false, error: 'Session not found' };
    }

    const booking = existingBooking[0];

    // Only allow marking as complete if session is in the past
    if (booking.startTime > new Date()) {
      return { success: false, error: 'Cannot mark a future session as complete' };
    }

    // Only allow completing confirmed or pending sessions
    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      return { success: false, error: 'Session cannot be marked as complete in its current state' };
    }

    // Update the session status
    await db.update(bookings).set({ status: 'completed' }).where(eq(bookings.id, sessionId));

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to mark session as complete' };
  }
}

export interface CancelSessionResult {
  success: boolean;
  error?: string;
}

export async function cancelSession(
  sessionId: number,
  reason?: string
): Promise<CancelSessionResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the session belongs to this coach
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, sessionId), eq(bookings.coachId, userId)))
      .limit(1);

    if (existingBooking.length === 0) {
      return { success: false, error: 'Session not found' };
    }

    const booking = existingBooking[0];

    // Only allow cancelling confirmed or pending sessions
    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      return { success: false, error: 'Session cannot be cancelled in its current state' };
    }

    // Update the session status
    await db
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: reason || null,
      })
      .where(eq(bookings.id, sessionId));

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to cancel session' };
  }
}
