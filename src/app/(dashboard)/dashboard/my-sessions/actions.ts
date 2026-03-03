/**
 * @fileoverview Client session management server actions.
 *
 * This module provides server actions for clients to manage their sessions:
 * - View sessions by status (upcoming, past/cancelled)
 * - Cancel sessions with refund processing
 * - Generate ICS calendar files
 * - Retry payment for unpaid bookings
 * - Check refund eligibility before cancelling
 *
 * @module my-sessions/actions
 *
 * @security
 * All actions require authentication via Clerk.
 * Clients can only access/modify sessions where they are the client.
 *
 * @refunds
 * Client-initiated cancellations follow a sliding scale refund policy:
 * - 48+ hours before: 100% refund
 * - 24-48 hours before: 50% refund
 * - Less than 24 hours: No refund
 *
 * This differs from coach cancellations which are always 100% refund.
 *
 * @see sessions/actions.ts for coach-side session management
 */
'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or, gte, lt, desc, asc, sql } from 'drizzle-orm';
import { db, bookings, users, coachProfiles, transactions } from '@/db';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import type { BookingSessionType } from '@/db/schema';
import { calculateRefundEligibility, formatRefundAmount } from '@/lib/refunds';
import { removeBookingFromCalendar } from '@/lib/google-calendar-sync';
import { formatDateLong, formatTime } from '@/lib/date-utils';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Session tab status for filtering client's session list.
 * - `upcoming`: Future sessions that are pending or confirmed
 * - `past`: Past sessions OR cancelled sessions (regardless of time)
 */
export type ClientSessionStatus = 'upcoming' | 'past';

/**
 * Payment status derived from transaction existence and status.
 * - `free`: Session has price of 0, no payment required
 * - `paid`: Transaction exists with 'succeeded' status
 * - `payment_required`: Paid session with no successful transaction
 * - `payment_failed`: Transaction exists with 'failed' status
 */
export type PaymentStatus = 'free' | 'paid' | 'payment_required' | 'payment_failed';

/**
 * Session data with coach information for client's view.
 * Combines booking data with coach user profile.
 */
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
  paymentStatus: PaymentStatus;
}

/**
 * Result of fetching client sessions.
 */
export interface GetClientSessionsResult {
  success: boolean;
  /** List of sessions when successful */
  sessions?: SessionWithCoach[];
  /** Total count for pagination (before limit/offset applied) */
  totalCount?: number;
  /** Error message when success is false */
  error?: string;
}

// ============================================================================
// Session Query Actions
// ============================================================================

/**
 * Retrieves paginated sessions for the authenticated client.
 *
 * Sessions are filtered by tab status:
 * - `upcoming`: Future sessions with pending/confirmed status, ordered by nearest first
 * - `past`: Past sessions OR any cancelled sessions, ordered by most recent first
 *
 * @param tab - Filter by session status ('upcoming', 'past')
 * @param page - Page number for pagination (1-indexed, default: 1)
 * @param perPage - Number of sessions per page (default: 10)
 * @returns Promise with sessions array, total count, or error
 *
 * @example
 * // Get first page of upcoming sessions
 * const result = await getClientSessions('upcoming');
 * if (result.success) {
 *   console.log(`Found ${result.totalCount} total sessions`);
 *   result.sessions?.forEach(s => console.log(s.coachName));
 * }
 */
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

    // Get payment status for each session
    const sessionsWithPayment: SessionWithCoach[] = await Promise.all(
      sessionsData.map(async (session) => {
        const sessionType = session.sessionType as BookingSessionType;

        // Free sessions (price = 0) don't require payment
        if (sessionType.price === 0) {
          return { ...session, paymentStatus: 'free' as PaymentStatus };
        }

        // Check for a transaction for this booking
        const transactionResult = await db
          .select({ status: transactions.status })
          .from(transactions)
          .where(eq(transactions.bookingId, session.id))
          .limit(1);

        if (transactionResult.length === 0) {
          return { ...session, paymentStatus: 'payment_required' as PaymentStatus };
        }

        const txStatus = transactionResult[0].status;
        if (txStatus === 'succeeded') {
          return { ...session, paymentStatus: 'paid' as PaymentStatus };
        } else if (txStatus === 'failed') {
          return { ...session, paymentStatus: 'payment_failed' as PaymentStatus };
        } else {
          return { ...session, paymentStatus: 'payment_required' as PaymentStatus };
        }
      })
    );

    return {
      success: true,
      sessions: sessionsWithPayment,
      totalCount,
    };
  } catch {
    return { success: false, error: 'Failed to fetch sessions' };
  }
}

// ============================================================================
// Cancellation Actions
// ============================================================================

/**
 * Information about a refund processed during cancellation.
 */
export interface RefundInfo {
  /** Whether a refund was successfully processed */
  wasRefunded: boolean;
  /** Refund amount in cents */
  refundAmountCents: number;
  /** Formatted refund amount (e.g., "$25.00") */
  refundAmountFormatted: string;
  /** Explanation of refund outcome */
  reason: string;
}

/**
 * Result of cancelling a session.
 */
export interface CancelSessionResult {
  success: boolean;
  /** Error message when success is false */
  error?: string;
  /** Refund details if a paid session was cancelled */
  refund?: RefundInfo;
}

/**
 * Cancels a session as the client.
 *
 * Client cancellations follow a sliding scale refund policy based on
 * how close to the session the cancellation occurs:
 * - 48+ hours before: 100% refund
 * - 24-48 hours before: 50% refund
 * - Less than 24 hours: No refund
 *
 * This is different from coach cancellations which always give 100% refund.
 *
 * Process:
 * 1. Verify session belongs to client and is in cancellable state
 * 2. Check for paid transaction
 * 3. Calculate refund based on timing policy
 * 4. If eligible, process refund via Stripe
 * 5. Update booking status to 'cancelled'
 * 6. Record cancellation metadata (who, when, reason)
 *
 * @param sessionId - The booking ID to cancel
 * @param reason - Optional cancellation reason for records
 * @returns Promise with success status and refund details if applicable
 *
 * @throws Returns error if session is already cancelled/completed
 *
 * @example
 * const result = await cancelClientSession(123, "Schedule conflict");
 * if (result.success) {
 *   if (result.refund?.wasRefunded) {
 *     console.log(`Refunded ${result.refund.refundAmountFormatted}`);
 *   } else {
 *     console.log(`No refund: ${result.refund?.reason}`);
 *   }
 * }
 */
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

    // Check if there's a paid transaction for this booking
    const transactionResult = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.bookingId, sessionId), eq(transactions.status, 'succeeded')))
      .limit(1);

    let refundInfo: RefundInfo | undefined;

    // If there's a paid transaction, evaluate refund eligibility
    if (transactionResult.length > 0) {
      const transaction = transactionResult[0];

      // Get coach currency for formatting
      const coachResult = await db
        .select({ currency: coachProfiles.currency })
        .from(coachProfiles)
        .where(eq(coachProfiles.userId, booking.coachId))
        .limit(1);
      const currency = coachResult[0]?.currency || 'USD';

      // Calculate refund eligibility based on cancellation timing
      const eligibility = calculateRefundEligibility(booking.startTime, transaction.amountCents);

      if (eligibility.isEligible && transaction.stripePaymentIntentId) {
        try {
          // Create refund via Stripe
          await stripe.refunds.create({
            payment_intent: transaction.stripePaymentIntentId,
            amount: eligibility.refundAmountCents,
            reason: 'requested_by_customer',
            metadata: {
              bookingId: sessionId.toString(),
              cancelledBy: 'client',
              cancelledByUserId: userId,
              refundPercentage: eligibility.refundPercentage.toString(),
            },
          });

          // Update transaction status
          await db
            .update(transactions)
            .set({
              status: 'refunded',
              refundAmountCents: eligibility.refundAmountCents,
            })
            .where(eq(transactions.id, transaction.id));

          refundInfo = {
            wasRefunded: true,
            refundAmountCents: eligibility.refundAmountCents,
            refundAmountFormatted: formatRefundAmount(eligibility.refundAmountCents, currency),
            reason: eligibility.reason,
          };
        } catch (stripeError) {
          console.error('Stripe refund failed:', stripeError);
          // Continue with cancellation but note refund failure
          refundInfo = {
            wasRefunded: false,
            refundAmountCents: 0,
            refundAmountFormatted: '$0.00',
            reason: 'Refund processing failed - please contact support',
          };
        }
      } else if (!eligibility.isEligible) {
        // No refund due to timing policy
        refundInfo = {
          wasRefunded: false,
          refundAmountCents: 0,
          refundAmountFormatted: formatRefundAmount(0, currency),
          reason: eligibility.reason,
        };
      }
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

    // Remove from Google Calendar
    removeBookingFromCalendar(sessionId).catch((error) => {
      console.error('Error removing cancelled session from calendar:', error);
    });

    return { success: true, refund: refundInfo };
  } catch {
    return { success: false, error: 'Failed to cancel session' };
  }
}

// ============================================================================
// Calendar Export Actions
// ============================================================================

/**
 * Generates an ICS (iCalendar) file for a booking.
 *
 * The ICS file allows clients to download and import session details
 * into their calendar application (Google Calendar, Outlook, Apple Calendar, etc.).
 *
 * ICS Format:
 * - Uses RFC 5545 iCalendar specification
 * - UID format: booking-{id}@coachingplatform.com (for deduplication)
 * - Includes session type name, duration, and client's notes
 * - Summary shows "Coaching Session with {CoachName}"
 *
 * @param bookingId - The booking ID to generate ICS for
 * @returns Promise with ICS file content string or error
 *
 * @example
 * const result = await generateClientIcsFile(123);
 * if (result.success) {
 *   // Create downloadable blob
 *   const blob = new Blob([result.data], { type: 'text/calendar' });
 *   // Trigger download...
 * }
 */
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

// ============================================================================
// Payment Retry Actions
// ============================================================================

/**
 * Result of creating a retry checkout session.
 */
export type CreateRetryCheckoutResult =
  | { success: true; checkoutUrl: string }
  | { success: false; error: string };

/**
 * Creates a Stripe Checkout session for an existing booking that needs payment.
 *
 * Used when:
 * - A booking was created but payment failed or was abandoned
 * - Client wants to complete payment for a pending booking
 *
 * Validation:
 * - Booking must belong to the authenticated client
 * - Booking must be a paid session (price > 0)
 * - Booking must be in the future (can't pay for past sessions)
 * - Booking must not already be paid
 * - Coach must have completed Stripe Connect onboarding
 *
 * The checkout session is created with:
 * - 10% platform fee (application_fee_amount)
 * - Remaining 90% transferred to coach (destination charge)
 * - Booking metadata for webhook processing
 * - Success URL: /coaches/{slug}/book/success?session_id={CHECKOUT_SESSION_ID}
 * - Cancel URL: /dashboard/sessions/{bookingId}
 *
 * @param bookingId - The booking ID to create checkout for
 * @param clientTimezone - Optional timezone for formatting session time in checkout
 * @returns Promise with Stripe Checkout URL or error
 *
 * @throws Returns error if session is free
 * @throws Returns error if session is in the past
 * @throws Returns error if already paid
 * @throws Returns error if coach hasn't set up payments
 *
 * @example
 * const result = await createRetryCheckoutSession(123, "America/New_York");
 * if (result.success) {
 *   // Redirect to Stripe Checkout
 *   window.location.href = result.checkoutUrl;
 * }
 */
export async function createRetryCheckoutSession(
  bookingId: number,
  clientTimezone?: string
): Promise<CreateRetryCheckoutResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'You must be signed in' };
    }

    // Get the booking details (must belong to this client)
    const bookingResult = await db
      .select({
        id: bookings.id,
        coachId: bookings.coachId,
        clientId: bookings.clientId,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
        clientNotes: bookings.clientNotes,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.clientId, userId)))
      .limit(1);

    if (bookingResult.length === 0) {
      return { success: false, error: 'Booking not found' };
    }

    const booking = bookingResult[0];
    const sessionType = booking.sessionType as BookingSessionType;

    // Verify this is a paid session
    if (sessionType.price === 0) {
      return { success: false, error: 'This is a free session and does not require payment' };
    }

    // Check if booking is still upcoming
    if (booking.startTime < new Date()) {
      return { success: false, error: 'Cannot pay for a past session' };
    }

    // Check if already paid
    const existingTransaction = await db
      .select({ status: transactions.status })
      .from(transactions)
      .where(and(eq(transactions.bookingId, bookingId), eq(transactions.status, 'succeeded')))
      .limit(1);

    if (existingTransaction.length > 0) {
      return { success: false, error: 'This booking has already been paid' };
    }

    // Get coach info
    const coachResult = await db
      .select({
        slug: coachProfiles.slug,
        timezone: coachProfiles.timezone,
        currency: coachProfiles.currency,
        stripeAccountId: coachProfiles.stripeAccountId,
        stripeOnboardingComplete: coachProfiles.stripeOnboardingComplete,
        coachName: users.name,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(coachProfiles.userId, users.id))
      .where(eq(coachProfiles.userId, booking.coachId))
      .limit(1);

    if (coachResult.length === 0) {
      return { success: false, error: 'Coach not found' };
    }

    const coach = coachResult[0];

    // Check if coach has Stripe set up
    if (!coach.stripeAccountId || !coach.stripeOnboardingComplete) {
      return {
        success: false,
        error: 'This coach has not set up payments yet. Please contact them directly.',
      };
    }

    // Get user email
    const userResult = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const userEmail = userResult.length > 0 ? userResult[0].email : undefined;

    // Get the host for success/cancel URLs
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Use provided timezone or fallback
    const timezone = clientTimezone || coach.timezone || 'America/New_York';

    // Calculate platform fee (10% of session price)
    const platformFeeAmount = Math.round(sessionType.price * 0.1);

    // Format date/time for display
    const sessionDate = formatDateLong(booking.startTime);
    const sessionTime = formatTime(booking.startTime);

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: userEmail,
      line_items: [
        {
          price_data: {
            currency: (coach.currency || 'usd').toLowerCase(),
            unit_amount: sessionType.price,
            product_data: {
              name: `Coaching Session: ${sessionType.name}`,
              description: `${sessionType.duration} minute session with ${coach.coachName || 'Coach'} on ${sessionDate} at ${sessionTime}`,
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
          coachId: booking.coachId,
          clientId: userId,
          sessionTypeName: sessionType.name,
          sessionDuration: sessionType.duration.toString(),
          sessionPrice: sessionType.price.toString(),
        },
      },
      metadata: {
        bookingId: bookingId.toString(),
        coachId: booking.coachId,
        clientId: userId,
        coachSlug: coach.slug,
        sessionTypeName: sessionType.name,
        sessionDuration: sessionType.duration.toString(),
        sessionPrice: sessionType.price.toString(),
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        clientTimezone: timezone,
      },
      success_url: `${baseUrl}/coaches/${coach.slug}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/sessions/${bookingId}`,
    });

    if (!checkoutSession.url) {
      return { success: false, error: 'Failed to create checkout session' };
    }

    return {
      success: true,
      checkoutUrl: checkoutSession.url,
    };
  } catch (error) {
    console.error('Error creating retry checkout session:', error);
    return { success: false, error: 'Failed to create checkout session. Please try again.' };
  }
}

// ============================================================================
// Refund Eligibility Actions
// ============================================================================

/**
 * Result of checking refund eligibility for a client session.
 */
export interface ClientRefundEligibilityResult {
  success: boolean;
  /** Error message when success is false */
  error?: string;
  /** Refund eligibility data when success is true */
  data?: {
    /** Whether a successful payment exists */
    hasPaidTransaction: boolean;
    /** Amount paid in cents */
    paidAmountCents: number;
    /** Currency code (e.g., "USD") */
    currency: string;
    /** Whether a refund can be issued */
    isEligibleForRefund: boolean;
    /** Amount to refund in cents (may be partial) */
    refundAmountCents: number;
    /** Formatted refund amount (e.g., "$25.00") */
    refundAmountFormatted: string;
    /** Explanation of refund policy */
    refundReason: string;
    /** Hours until the session starts (determines refund %) */
    hoursUntilSession: number;
  };
}

/**
 * Gets refund eligibility information for a client session.
 *
 * Used by the cancellation dialog to show the client what refund
 * they would receive if they cancel. Refund amounts follow a sliding scale:
 * - 48+ hours: 100% of paid amount
 * - 24-48 hours: 50% of paid amount
 * - Less than 24 hours: 0%
 *
 * @param sessionId - The booking ID to check
 * @returns Promise with refund eligibility details or error
 *
 * @example
 * const result = await getClientRefundEligibility(123);
 * if (result.success && result.data) {
 *   const { hoursUntilSession, refundAmountFormatted, refundReason } = result.data;
 *   console.log(`${hoursUntilSession}h until session`);
 *   console.log(`Refund: ${refundAmountFormatted}`);
 *   console.log(`Policy: ${refundReason}`);
 * }
 */
export async function getClientRefundEligibility(
  sessionId: number
): Promise<ClientRefundEligibilityResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Get the booking (must belong to this client)
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, sessionId), eq(bookings.clientId, userId)))
      .limit(1);

    if (existingBooking.length === 0) {
      return { success: false, error: 'Session not found' };
    }

    const booking = existingBooking[0];

    // Get coach currency
    const coachResult = await db
      .select({ currency: coachProfiles.currency })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, booking.coachId))
      .limit(1);
    const currency = coachResult[0]?.currency || 'USD';

    // Check for paid transaction
    const transactionResult = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.bookingId, sessionId), eq(transactions.status, 'succeeded')))
      .limit(1);

    if (transactionResult.length === 0) {
      // No paid transaction
      const msUntilSession = booking.startTime.getTime() - Date.now();
      const hoursUntilSession = msUntilSession / (1000 * 60 * 60);
      return {
        success: true,
        data: {
          hasPaidTransaction: false,
          paidAmountCents: 0,
          currency,
          isEligibleForRefund: false,
          refundAmountCents: 0,
          refundAmountFormatted: formatRefundAmount(0, currency),
          refundReason: 'No payment on file',
          hoursUntilSession,
        },
      };
    }

    const transaction = transactionResult[0];

    // Calculate refund eligibility based on timing
    const eligibility = calculateRefundEligibility(booking.startTime, transaction.amountCents);

    return {
      success: true,
      data: {
        hasPaidTransaction: true,
        paidAmountCents: transaction.amountCents,
        currency,
        isEligibleForRefund: eligibility.isEligible,
        refundAmountCents: eligibility.refundAmountCents,
        refundAmountFormatted: formatRefundAmount(eligibility.refundAmountCents, currency),
        refundReason: eligibility.reason,
        hoursUntilSession: eligibility.hoursUntilSession,
      },
    };
  } catch {
    return { success: false, error: 'Failed to get refund eligibility' };
  }
}
