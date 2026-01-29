'use server';

import { auth } from '@clerk/nextjs/server';
import { db, bookings, users, coachProfiles } from '@/db';
import { eq } from 'drizzle-orm';
import type { BookingSessionType } from '@/db/schema';

// Input for creating a booking
export interface CreateBookingInput {
  coachId: string;
  sessionType: BookingSessionType;
  startTime: string; // ISO string
  endTime: string; // ISO string
  clientNotes?: string;
}

// Booking result with details for confirmation
export interface BookingResult {
  id: number;
  coachName: string;
  coachAvatarUrl: string | null;
  sessionType: BookingSessionType;
  startTime: Date;
  endTime: Date;
  clientNotes: string | null;
  coachTimezone: string;
  coachSlug: string;
}

// Create a new booking
export async function createBooking(
  input: CreateBookingInput
): Promise<{ success: true; data: BookingResult } | { success: false; error: string }> {
  try {
    // Check authentication
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'You must be signed in to book a session' };
    }

    // Verify the user exists in our database
    const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (userResult.length === 0) {
      return { success: false, error: 'User not found. Please sign in again.' };
    }

    // Get coach profile info
    const coachResult = await db
      .select({
        userId: coachProfiles.userId,
        slug: coachProfiles.slug,
        timezone: coachProfiles.timezone,
        coachName: users.name,
        coachAvatarUrl: users.avatarUrl,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(coachProfiles.userId, users.id))
      .where(eq(coachProfiles.userId, input.coachId))
      .limit(1);

    if (coachResult.length === 0) {
      return { success: false, error: 'Coach not found' };
    }

    const coach = coachResult[0];

    // Prevent booking with yourself
    if (userId === input.coachId) {
      return { success: false, error: 'You cannot book a session with yourself' };
    }

    // Parse the times
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);

    // Validate times
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return { success: false, error: 'Invalid booking times' };
    }

    if (startTime >= endTime) {
      return { success: false, error: 'Start time must be before end time' };
    }

    if (startTime < new Date()) {
      return { success: false, error: 'Cannot book a session in the past' };
    }

    // Create the booking with 'confirmed' status
    const newBooking = await db
      .insert(bookings)
      .values({
        coachId: input.coachId,
        clientId: userId,
        sessionType: input.sessionType,
        startTime,
        endTime,
        status: 'confirmed',
        clientNotes: input.clientNotes || null,
      })
      .returning({ id: bookings.id });

    if (newBooking.length === 0) {
      return { success: false, error: 'Failed to create booking' };
    }

    return {
      success: true,
      data: {
        id: newBooking[0].id,
        coachName: coach.coachName || 'Coach',
        coachAvatarUrl: coach.coachAvatarUrl,
        sessionType: input.sessionType,
        startTime,
        endTime,
        clientNotes: input.clientNotes || null,
        coachTimezone: coach.timezone || 'America/New_York',
        coachSlug: coach.slug,
      },
    };
  } catch (error) {
    console.error('Error creating booking:', error);
    return { success: false, error: 'Failed to create booking. Please try again.' };
  }
}

// Generate ICS file content for calendar download
export async function generateIcsFile(
  bookingId: number
): Promise<{ success: true; data: string } | { success: false; error: string }> {
  try {
    // Get the booking details
    const booking = await db
      .select({
        id: bookings.id,
        coachId: bookings.coachId,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        clientNotes: bookings.clientNotes,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
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
  } catch (error) {
    console.error('Error generating ICS file:', error);
    return { success: false, error: 'Failed to generate calendar file' };
  }
}
