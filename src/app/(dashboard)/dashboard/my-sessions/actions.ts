'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or, gte, lt, desc, asc, sql } from 'drizzle-orm';
import { db, bookings, users, coachProfiles } from '@/db';
import type { BookingSessionType } from '@/db/schema';

export type ClientSessionStatus = 'upcoming' | 'past';

export interface SessionWithCoach {
  id: number;
  coachId: string;
  coachName: string | null;
  coachAvatar: string | null;
  coachSlug: string;
  sessionType: BookingSessionType;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  clientNotes: string | null;
  createdAt: Date;
}

export interface GetClientSessionsResult {
  success: boolean;
  sessions?: SessionWithCoach[];
  totalCount?: number;
  error?: string;
}

export async function getClientSessions(
  tab: ClientSessionStatus,
  page: number = 1,
  perPage: number = 10
): Promise<GetClientSessionsResult> {
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
      // Upcoming: future sessions with confirmed or pending status (not cancelled)
      statusCondition = and(
        eq(bookings.clientId, userId),
        gte(bookings.startTime, now),
        or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'pending'))
      );
      orderDirection = asc; // Nearest session first
    } else {
      // Past: sessions that already happened OR were cancelled
      statusCondition = and(
        eq(bookings.clientId, userId),
        or(
          // Past sessions
          and(
            lt(bookings.startTime, now),
            or(
              eq(bookings.status, 'completed'),
              eq(bookings.status, 'no_show'),
              eq(bookings.status, 'confirmed'),
              eq(bookings.status, 'pending')
            )
          ),
          // Cancelled sessions (regardless of time)
          eq(bookings.status, 'cancelled')
        )
      );
      orderDirection = desc; // Most recent first
    }

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(statusCondition);

    const totalCount = countResult[0]?.count || 0;

    // Get sessions with coach info
    const sessionsData = await db
      .select({
        id: bookings.id,
        coachId: bookings.coachId,
        coachName: users.name,
        coachAvatar: users.avatarUrl,
        coachSlug: coachProfiles.slug,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
        clientNotes: bookings.clientNotes,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.coachId, users.id))
      .innerJoin(coachProfiles, eq(bookings.coachId, coachProfiles.userId))
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

export interface CancelSessionResult {
  success: boolean;
  error?: string;
}

export async function cancelClientSession(
  sessionId: number,
  reason?: string
): Promise<CancelSessionResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the session belongs to this client
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, sessionId), eq(bookings.clientId, userId)))
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

// Generate ICS file content for calendar download
export async function generateClientIcsFile(
  bookingId: number
): Promise<{ success: true; data: string } | { success: false; error: string }> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Get the booking details (must belong to this client)
    const booking = await db
      .select({
        id: bookings.id,
        coachId: bookings.coachId,
        clientId: bookings.clientId,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        clientNotes: bookings.clientNotes,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.clientId, userId)))
      .limit(1);

    if (booking.length === 0) {
      return { success: false, error: 'Booking not found' };
    }

    const bookingData = booking[0];

    // Get coach info
    const coach = await db
      .select({
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, bookingData.coachId))
      .limit(1);

    const coachName = coach.length > 0 ? coach[0].name || 'Coach' : 'Coach';

    // Format dates for ICS (YYYYMMDDTHHMMSSZ)
    const formatIcsDate = (date: Date) => {
      return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    };

    const sessionType = bookingData.sessionType as BookingSessionType;

    // Generate ICS content
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Coaching Platform//Booking//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:booking-${bookingData.id}@coachingplatform.com`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(bookingData.startTime)}`,
      `DTEND:${formatIcsDate(bookingData.endTime)}`,
      `SUMMARY:Coaching Session with ${coachName}`,
      `DESCRIPTION:${sessionType.name} (${sessionType.duration} minutes)${bookingData.clientNotes ? '\\n\\nNotes: ' + bookingData.clientNotes.replace(/\n/g, '\\n') : ''}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return { success: true, data: icsContent };
  } catch {
    return { success: false, error: 'Failed to generate calendar file' };
  }
}
