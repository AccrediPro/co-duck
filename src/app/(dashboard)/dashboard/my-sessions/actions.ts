'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or, gte, lt, desc, asc, sql } from 'drizzle-orm';
import { db, bookings, users, coachProfiles, transactions } from '@/db';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import type { BookingSessionType } from '@/db/schema';
import { calculateRefundEligibility, formatRefundAmount } from '@/lib/refunds';

export type ClientSessionStatus = 'upcoming' | 'past';

// Payment status derived from transaction existence and status
export type PaymentStatus = 'free' | 'paid' | 'payment_required' | 'payment_failed';

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

export interface RefundInfo {
  wasRefunded: boolean;
  refundAmountCents: number;
  refundAmountFormatted: string;
  reason: string;
}

export interface CancelSessionResult {
  success: boolean;
  error?: string;
  refund?: RefundInfo;
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

    return { success: true, refund: refundInfo };
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

// Result of creating a checkout session for an existing booking
export type CreateRetryCheckoutResult =
  | { success: true; checkoutUrl: string }
  | { success: false; error: string };

// Create a Stripe Checkout session for an existing booking that needs payment (retry)
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
    const sessionDate = booking.startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    });
    const sessionTime = booking.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });

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

// Get refund eligibility info for a booking (used by client cancellation dialog)
export interface ClientRefundEligibilityResult {
  success: boolean;
  error?: string;
  data?: {
    hasPaidTransaction: boolean;
    paidAmountCents: number;
    currency: string;
    isEligibleForRefund: boolean;
    refundAmountCents: number;
    refundAmountFormatted: string;
    refundReason: string;
    hoursUntilSession: number;
  };
}

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
