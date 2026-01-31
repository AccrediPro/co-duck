/**
 * @fileoverview Booking Success Server Actions
 *
 * This module handles the final phase of the booking flow: retrieving booking
 * details after successful Stripe payment and generating calendar files.
 *
 * ## Booking Flow Overview
 * 1. `../actions.ts`: Get coach data, weekly availability, and available time slots
 * 2. `../confirm/actions.ts`: Create booking and Stripe Checkout session
 * 3. **This file**: Handle post-payment confirmation and display
 *
 * ## Key Responsibilities
 * - Retrieve booking from Stripe Checkout session ID
 * - Confirm pending bookings after successful payment
 * - Create transaction records for payment tracking
 * - Generate ICS calendar files for download
 * - Trigger conversation system messages
 *
 * ## Payment Confirmation Flow
 * 1. Client redirected from Stripe with session_id query param
 * 2. This module retrieves checkout session from Stripe
 * 3. If payment succeeded, booking status updated to 'confirmed'
 * 4. Transaction record created for financial tracking
 * 5. System message sent in coach-client conversation
 *
 * @module booking/success/actions
 */

'use server';

import { db, bookings, users, coachProfiles, transactions } from '@/db';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import type { BookingSessionType } from '@/db/schema';
import { createBookingSystemMessage } from '@/lib/conversations';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Booking data returned for the success page display.
 * Contains all information needed to show confirmation details.
 */
export interface BookingSuccessData {
  id: number;
  coachName: string;
  coachAvatarUrl: string | null;
  sessionType: BookingSessionType;
  startTime: Date;
  endTime: Date;
  clientNotes: string | null;
  coachTimezone: string;
  coachSlug: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  amountPaid: number;
  currency: string;
}

/**
 * Result type for the getBookingFromCheckoutSession function.
 */
export type GetBookingFromCheckoutSessionResult =
  | { success: true; data: BookingSuccessData }
  | { success: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves and confirms a booking from a Stripe Checkout session.
 *
 * This function is called when the client is redirected back from Stripe
 * after completing payment. It performs the following:
 *
 * 1. Retrieves the Checkout Session from Stripe (with payment_intent expanded)
 * 2. Extracts booking ID from session metadata
 * 3. Fetches booking and coach details from database
 * 4. If payment succeeded and booking is pending:
 *    - Updates booking status to 'confirmed'
 *    - Creates transaction record (if not exists)
 *    - Triggers conversation system message
 *
 * ## Idempotency
 * This function is idempotent - it can be called multiple times safely.
 * Transaction creation is guarded by checking for existing records.
 *
 * ## Platform Fee Calculation
 * - Platform fee: 10% of total amount
 * - Coach payout: 90% of total amount
 *
 * @param sessionId - Stripe Checkout Session ID from URL query param
 * @returns Success with BookingSuccessData, or error message
 *
 * @example
 * // Called on success page load
 * const searchParams = useSearchParams();
 * const sessionId = searchParams.get('session_id');
 * const result = await getBookingFromCheckoutSession(sessionId);
 */
export async function getBookingFromCheckoutSession(
  sessionId: string
): Promise<GetBookingFromCheckoutSessionResult> {
  try {
    // Retrieve the Checkout Session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    if (!checkoutSession) {
      return { success: false, error: 'Checkout session not found' };
    }

    // Get booking ID from metadata
    const bookingId = checkoutSession.metadata?.bookingId;

    if (!bookingId) {
      return { success: false, error: 'Booking information not found' };
    }

    // Fetch the booking from database
    const bookingResult = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, parseInt(bookingId)))
      .limit(1);

    if (bookingResult.length === 0) {
      return { success: false, error: 'Booking not found' };
    }

    const booking = bookingResult[0];

    // Get coach info
    const coachResult = await db
      .select({
        userId: coachProfiles.userId,
        slug: coachProfiles.slug,
        timezone: coachProfiles.timezone,
        currency: coachProfiles.currency,
        coachName: users.name,
        coachAvatarUrl: users.avatarUrl,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(coachProfiles.userId, users.id))
      .where(eq(coachProfiles.userId, booking.coachId))
      .limit(1);

    if (coachResult.length === 0) {
      return { success: false, error: 'Coach not found' };
    }

    const coach = coachResult[0];
    const sessionType = booking.sessionType as BookingSessionType;

    // Check payment status and update booking if needed
    if (checkoutSession.payment_status === 'paid' && booking.status === 'pending') {
      // Update booking to confirmed
      await db.update(bookings).set({ status: 'confirmed' }).where(eq(bookings.id, booking.id));

      // Get payment intent for transaction record
      const paymentIntent = checkoutSession.payment_intent;
      const paymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id;

      // Create transaction record if it doesn't exist
      const existingTransaction = await db
        .select()
        .from(transactions)
        .where(eq(transactions.stripeCheckoutSessionId, sessionId))
        .limit(1);

      if (existingTransaction.length === 0 && paymentIntentId) {
        const amountTotal = checkoutSession.amount_total || sessionType.price;
        const platformFee = Math.round(amountTotal * 0.1);
        const coachPayout = amountTotal - platformFee;

        await db.insert(transactions).values({
          bookingId: booking.id,
          coachId: booking.coachId,
          clientId: booking.clientId,
          amountCents: amountTotal,
          currency: (coach.currency || 'usd').toLowerCase(),
          platformFeeCents: platformFee,
          coachPayoutCents: coachPayout,
          stripePaymentIntentId: paymentIntentId,
          stripeCheckoutSessionId: sessionId,
          status: 'succeeded',
        });

        // Create system message in conversation for the booking
        // This runs asynchronously and doesn't block the booking flow
        createBookingSystemMessage(
          booking.coachId,
          booking.clientId,
          sessionType,
          booking.startTime
        ).catch((error) => {
          console.error('Error creating booking system message:', error);
          // Don't fail the booking if message creation fails
        });
      }

      // Update status to confirmed for return value
      booking.status = 'confirmed';
    }

    return {
      success: true,
      data: {
        id: booking.id,
        coachName: coach.coachName || 'Coach',
        coachAvatarUrl: coach.coachAvatarUrl,
        sessionType,
        startTime: booking.startTime,
        endTime: booking.endTime,
        clientNotes: booking.clientNotes,
        coachTimezone: coach.timezone || 'America/New_York',
        coachSlug: coach.slug,
        status: booking.status,
        amountPaid: checkoutSession.amount_total || sessionType.price,
        currency: (coach.currency || 'USD').toUpperCase(),
      },
    };
  } catch (error) {
    console.error('Error fetching booking from checkout session:', error);
    return { success: false, error: 'Failed to retrieve booking details' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates an ICS (iCalendar) file for a confirmed booking.
 *
 * Creates a downloadable calendar file that clients can add to their
 * calendar applications. This is a duplicate of the function in confirm/actions.ts
 * for use on the success page.
 *
 * ## ICS Format Details
 * - iCalendar 2.0 specification (RFC 5545)
 * - Includes: summary, description, start/end times
 * - Unique UID prevents duplicate events: `booking-{id}@coachingplatform.com`
 * - Client notes are included in description if present
 *
 * @param bookingId - The database ID of the booking
 * @returns Success with ICS file content as string, or error
 *
 * @example
 * const result = await generateSuccessIcsFile(123);
 * if (result.success) {
 *   // Trigger download
 *   const blob = new Blob([result.data], { type: 'text/calendar' });
 *   const url = URL.createObjectURL(blob);
 *   // Create download link...
 * }
 */
export async function generateSuccessIcsFile(
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
