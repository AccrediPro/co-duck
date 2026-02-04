import { eq } from 'drizzle-orm';
import { db, bookings, users, googleCalendarTokens } from '@/db';
import type { BookingSessionType } from '@/db/schema';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  isGoogleCalendarConfigured,
} from './google-calendar';

/**
 * Sync a confirmed booking to Google Calendar for connected users.
 * Creates calendar events for both coach and client if they have Google Calendar connected.
 * Failures are silently caught - calendar sync never blocks primary operations.
 */
export async function syncBookingToCalendar(bookingId: number): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;

  try {
    const bookingResult = await db
      .select({
        id: bookings.id,
        coachId: bookings.coachId,
        clientId: bookings.clientId,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        meetingLink: bookings.meetingLink,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (bookingResult.length === 0) return;

    const booking = bookingResult[0];
    const sessionType = booking.sessionType as BookingSessionType;

    // Get user names
    const [coachUserResult, clientUserResult] = await Promise.all([
      db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, booking.coachId))
        .limit(1),
      db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, booking.clientId))
        .limit(1),
    ]);

    const coachName = coachUserResult[0]?.name || null;
    const coachEmail = coachUserResult[0]?.email || null;
    const clientName = clientUserResult[0]?.name || null;
    const clientEmail = clientUserResult[0]?.email || null;

    // Check which users have Google Calendar connected
    const connectedTokens = await db
      .select({ userId: googleCalendarTokens.userId })
      .from(googleCalendarTokens)
      .where(eq(googleCalendarTokens.isConnected, true));

    const connectedUserIds = new Set(connectedTokens.map((t) => t.userId));

    // Sync for coach
    if (connectedUserIds.has(booking.coachId)) {
      try {
        const eventId = await createCalendarEvent(booking.coachId, {
          id: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          sessionType,
          meetingLink: booking.meetingLink,
          otherUserName: clientName,
          otherUserEmail: clientEmail,
          isCoach: true,
        });

        if (eventId) {
          await db
            .update(bookings)
            .set({ googleCalendarEventId: eventId })
            .where(eq(bookings.id, bookingId));
        }
      } catch (error) {
        console.error(`Failed to sync booking ${bookingId} to coach calendar:`, error);
      }
    }

    // Sync for client
    if (connectedUserIds.has(booking.clientId)) {
      try {
        await createCalendarEvent(booking.clientId, {
          id: booking.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          sessionType,
          meetingLink: booking.meetingLink,
          otherUserName: coachName,
          otherUserEmail: coachEmail,
          isCoach: false,
        });
      } catch (error) {
        console.error(`Failed to sync booking ${bookingId} to client calendar:`, error);
      }
    }
  } catch (error) {
    console.error(`Failed to sync booking ${bookingId} to calendar:`, error);
  }
}

/**
 * Update an existing calendar event when a booking is rescheduled or meeting link changes.
 */
export async function updateBookingInCalendar(bookingId: number): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;

  try {
    const bookingResult = await db
      .select({
        id: bookings.id,
        coachId: bookings.coachId,
        clientId: bookings.clientId,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        meetingLink: bookings.meetingLink,
        googleCalendarEventId: bookings.googleCalendarEventId,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (bookingResult.length === 0) return;

    const booking = bookingResult[0];
    const eventId = booking.googleCalendarEventId;
    if (!eventId) return;

    const sessionType = booking.sessionType as BookingSessionType;

    // Get user names
    const [clientUser] = await Promise.all([
      db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, booking.clientId))
        .limit(1),
      db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, booking.coachId))
        .limit(1),
    ]);

    // Try updating for coach
    try {
      await updateCalendarEvent(booking.coachId, eventId, {
        startTime: booking.startTime,
        endTime: booking.endTime,
        sessionType,
        meetingLink: booking.meetingLink,
        otherUserName: clientUser[0]?.name || null,
      });
    } catch (error) {
      console.error(`Failed to update coach calendar event for booking ${bookingId}:`, error);
    }
  } catch (error) {
    console.error(`Failed to update booking ${bookingId} in calendar:`, error);
  }
}

/**
 * Remove a calendar event when a booking is cancelled.
 */
export async function removeBookingFromCalendar(bookingId: number): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;

  try {
    const bookingResult = await db
      .select({
        coachId: bookings.coachId,
        clientId: bookings.clientId,
        googleCalendarEventId: bookings.googleCalendarEventId,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (bookingResult.length === 0) return;

    const booking = bookingResult[0];
    const eventId = booking.googleCalendarEventId;
    if (!eventId) return;

    // Try deleting for coach
    try {
      await deleteCalendarEvent(booking.coachId, eventId);
    } catch (error) {
      console.error(`Failed to delete coach calendar event for booking ${bookingId}:`, error);
    }

    // Try deleting for client
    try {
      await deleteCalendarEvent(booking.clientId, eventId);
    } catch (error) {
      console.error(`Failed to delete client calendar event for booking ${bookingId}:`, error);
    }

    // Clear the event ID
    await db
      .update(bookings)
      .set({ googleCalendarEventId: null })
      .where(eq(bookings.id, bookingId));
  } catch (error) {
    console.error(`Failed to remove booking ${bookingId} from calendar:`, error);
  }
}
