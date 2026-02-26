/**
 * @fileoverview Booking Confirmation Server Actions
 *
 * This module handles the second phase of the booking flow: creating bookings
 * and initiating Stripe Checkout sessions for paid sessions.
 *
 * ## Booking Flow Overview
 * 1. `../actions.ts`: Get coach data, weekly availability, and available time slots
 * 2. **This file**: Create booking and Stripe Checkout session
 * 3. `../success/actions.ts`: Handle post-payment confirmation and display
 *
 * ## Payment Flow
 * - **Free sessions**: Created with 'pending' status, confirmed after coach approval
 * - **Paid sessions**: Created with 'pending' status, confirmed after coach approval
 *
 * ## Stripe Integration
 * - Uses Stripe Connect for split payments (coach payout + platform fee)
 * - Platform fee: 10% of session price
 * - Booking metadata stored in Stripe for webhook reconciliation
 *
 * @module booking/confirm/actions
 */

'use server';

import { auth } from '@clerk/nextjs/server';
import { db, bookings, users, coachProfiles } from '@/db';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import type { BookingSessionType } from '@/db/schema';
import { createBookingSystemMessage } from '@/lib/conversations';
import { createNotification } from '@/lib/notifications';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input parameters for creating a new booking (free sessions).
 */
export interface CreateBookingInput {
  /** The coach's user ID */
  coachId: string;
  /** Selected session type with name, duration, and price */
  sessionType: BookingSessionType;
  /** Session start time as ISO 8601 string */
  startTime: string;
  /** Session end time as ISO 8601 string */
  endTime: string;
  /** Optional notes from the client about the session */
  clientNotes?: string;
}

/**
 * Result data returned after successfully creating a booking.
 * Contains all information needed for the confirmation display.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new booking for a free session.
 *
 * For free sessions (price = 0), the booking is created with 'pending' status
 * awaiting coach approval. A system message is also created in the coach-client conversation.
 *
 * ## Validation Checks
 * - User must be authenticated
 * - User must exist in database
 * - Coach must exist
 * - Cannot book with yourself
 * - Start time must be before end time
 * - Cannot book in the past
 *
 * @param input - Booking details including coach, session type, and times
 * @returns Success with BookingResult, or error message
 *
 * @example
 * const result = await createBooking({
 *   coachId: 'user_coach123',
 *   sessionType: { name: 'Intro Call', duration: 30, price: 0 },
 *   startTime: '2024-01-15T14:00:00.000Z',
 *   endTime: '2024-01-15T14:30:00.000Z',
 *   clientNotes: 'Looking forward to our session!'
 * });
 */
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

    // Create the booking with 'pending' status (coach must approve)
    const newBooking = await db
      .insert(bookings)
      .values({
        coachId: input.coachId,
        clientId: userId,
        sessionType: input.sessionType,
        startTime,
        endTime,
        status: 'pending',
        clientNotes: input.clientNotes || null,
      })
      .returning({ id: bookings.id });

    if (newBooking.length === 0) {
      return { success: false, error: 'Failed to create booking' };
    }

    // Create system message in conversation for the booking
    // This runs asynchronously and doesn't block the booking flow
    createBookingSystemMessage(input.coachId, userId, input.sessionType, startTime).catch(
      (error) => {
        console.error('Error creating booking system message:', error);
        // Don't fail the booking if message creation fails
      }
    );

    // Notify coach about new booking request
    const clientName = userResult[0].name || 'A client';
    createNotification({
      userId: input.coachId,
      type: 'booking_confirmed',
      title: 'New booking request',
      body: `${clientName} has requested a ${input.sessionType.name}.`,
      link: `/dashboard/sessions/${newBooking[0].id}`,
    });

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

/**
 * Input parameters for creating a Stripe Checkout session (paid sessions).
 */
export interface CreateCheckoutSessionInput {
  /** The coach's user ID */
  coachId: string;
  /** The coach's URL slug (for redirect URLs) */
  coachSlug: string;
  /** Selected session type with name, duration, and price */
  sessionType: BookingSessionType;
  /** Session start time as ISO 8601 string */
  startTime: string;
  /** Session end time as ISO 8601 string */
  endTime: string;
  /** Optional notes from the client about the session */
  clientNotes?: string;
  /** Client's IANA timezone for display formatting */
  clientTimezone: string;
}

/**
 * Result of Stripe Checkout session creation.
 */
export type CreateCheckoutSessionResult =
  | { success: true; checkoutUrl: string; bookingId: number }
  | { success: false; error: string };

/**
 * Creates a Stripe Checkout Session for paid bookings.
 *
 * This function handles the payment flow for sessions with a price > 0:
 * 1. Creates a booking with 'pending' status
 * 2. Creates a Stripe Checkout Session with split payment configuration
 * 3. Returns the checkout URL for redirect
 *
 * ## Payment Split (Stripe Connect)
 * - **Coach receives**: 90% of session price
 * - **Platform fee**: 10% of session price
 *
 * ## Stripe Metadata
 * Booking details are stored in both session-level and payment_intent-level
 * metadata for webhook processing and reconciliation.
 *
 * ## Error Handling
 * If Checkout Session creation fails, the pending booking is rolled back (deleted).
 *
 * @param input - Checkout details including coach, session type, times, and timezone
 * @returns Success with checkoutUrl and bookingId, or error message
 *
 * @throws Will not throw - errors are returned in the result object
 *
 * @example
 * const result = await createCheckoutSession({
 *   coachId: 'user_coach123',
 *   coachSlug: 'john-smith',
 *   sessionType: { name: '1-on-1 Coaching', duration: 60, price: 10000 },
 *   startTime: '2024-01-15T14:00:00.000Z',
 *   endTime: '2024-01-15T15:00:00.000Z',
 *   clientTimezone: 'America/Los_Angeles'
 * });
 * if (result.success) {
 *   // Redirect to result.checkoutUrl
 * }
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
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

    const user = userResult[0];

    // Get coach profile info including Stripe account
    const coachResult = await db
      .select({
        userId: coachProfiles.userId,
        slug: coachProfiles.slug,
        timezone: coachProfiles.timezone,
        currency: coachProfiles.currency,
        stripeAccountId: coachProfiles.stripeAccountId,
        stripeOnboardingComplete: coachProfiles.stripeOnboardingComplete,
        coachName: users.name,
        coachEmail: users.email,
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

    // Check if coach has completed Stripe onboarding
    if (!coach.stripeAccountId || !coach.stripeOnboardingComplete) {
      return {
        success: false,
        error: 'This coach has not set up payments yet. Please contact them directly.',
      };
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

    // Create the booking with 'pending' status (will be confirmed after payment)
    const newBooking = await db
      .insert(bookings)
      .values({
        coachId: input.coachId,
        clientId: userId,
        sessionType: input.sessionType,
        startTime,
        endTime,
        status: 'pending',
        clientNotes: input.clientNotes || null,
      })
      .returning({ id: bookings.id });

    if (newBooking.length === 0) {
      return { success: false, error: 'Failed to create booking' };
    }

    const bookingId = newBooking[0].id;

    // Get the host for success/cancel URLs
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Build cancel URL with current booking params
    const cancelParams = new URLSearchParams({
      sessionId: input.sessionType.name.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now(),
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.clientTimezone,
    });
    const cancelUrl = `${baseUrl}/coaches/${input.coachSlug}/book/confirm?${cancelParams.toString()}`;

    // Calculate platform fee (10% of session price)
    const platformFeeAmount = Math.round(input.sessionType.price * 0.1);

    // Format date/time for display
    const sessionDate = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: input.clientTimezone,
    });
    const sessionTime = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: input.clientTimezone,
    });

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: (coach.currency || 'usd').toLowerCase(),
            unit_amount: input.sessionType.price,
            product_data: {
              name: `Coaching Session: ${input.sessionType.name}`,
              description: `${input.sessionType.duration} minute session with ${coach.coachName || 'Coach'} on ${sessionDate} at ${sessionTime}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        transfer_data: {
          destination: coach.stripeAccountId,
        },
        application_fee_amount: platformFeeAmount,
        metadata: {
          bookingId: bookingId.toString(),
          coachId: input.coachId,
          clientId: userId,
          sessionTypeName: input.sessionType.name,
          sessionDuration: input.sessionType.duration.toString(),
          sessionPrice: input.sessionType.price.toString(),
        },
      },
      metadata: {
        bookingId: bookingId.toString(),
        coachId: input.coachId,
        clientId: userId,
        coachSlug: input.coachSlug,
        sessionTypeName: input.sessionType.name,
        sessionDuration: input.sessionType.duration.toString(),
        sessionPrice: input.sessionType.price.toString(),
        startTime: input.startTime,
        endTime: input.endTime,
        clientTimezone: input.clientTimezone,
      },
      success_url: `${baseUrl}/coaches/${input.coachSlug}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    if (!checkoutSession.url) {
      // Rollback the booking if we couldn't create a checkout URL
      await db.delete(bookings).where(eq(bookings.id, bookingId));
      return { success: false, error: 'Failed to create checkout session' };
    }

    return {
      success: true,
      checkoutUrl: checkoutSession.url,
      bookingId,
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return { success: false, error: 'Failed to create checkout session. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates an ICS (iCalendar) file for a booking.
 *
 * Creates a downloadable calendar file that clients can add to their
 * calendar applications (Google Calendar, Apple Calendar, Outlook, etc.).
 *
 * ## ICS Format
 * - Uses iCalendar 2.0 specification
 * - Includes session summary, duration, and client notes
 * - Generates a unique UID for calendar deduplication
 *
 * @param bookingId - The database ID of the booking
 * @returns Success with ICS file content as string, or error
 *
 * @example
 * const result = await generateIcsFile(123);
 * if (result.success) {
 *   // Create download link with result.data as file content
 *   const blob = new Blob([result.data], { type: 'text/calendar' });
 * }
 */
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
