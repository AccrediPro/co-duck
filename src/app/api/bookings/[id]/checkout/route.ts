/**
 * @fileoverview Create Stripe Checkout Session for a Pending Booking
 *
 * This endpoint creates a Stripe Checkout session for an existing booking
 * that has status='pending'. Designed for mobile clients that cannot use
 * Next.js server actions and need a REST API to get a checkout URL.
 *
 * ## Flow
 * 1. Client creates booking via `POST /api/bookings` (status='pending')
 * 2. Client calls this endpoint to get a Stripe checkout URL
 * 3. Client opens the URL (in-app browser or Stripe SDK)
 * 4. Stripe webhook confirms the booking on successful payment
 *
 * @module api/bookings/[id]/checkout
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, users, coachProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import type { BookingSessionType } from '@/db/schema';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { formatDateLong, formatTime } from '@/lib/date-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/bookings/:id/checkout
 *
 * Creates a Stripe Checkout Session for a pending booking.
 * Only the booking's client can create a checkout session.
 *
 * @body {string} clientTimezone - Client's IANA timezone (e.g. "America/New_York")
 *
 * @returns {Object} { success: true, checkoutUrl: string, bookingId: number }
 *
 * @errors
 * - 401: Not authenticated
 * - 400: Invalid booking ID
 * - 404: Booking not found
 * - 403: Not the booking's client
 * - 400: Booking is not in 'pending' status
 * - 400: Coach hasn't set up Stripe
 * - 500: Stripe checkout creation failed
 */
export async function POST(request: Request, { params }: RouteParams) {
  // Rate limit: 10 requests per minute
  const rl = rateLimit(request, WRITE_LIMIT, 'bookings-checkout');
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
    const bookingId = parseInt(id);

    if (isNaN(bookingId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid booking ID' } },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const clientTimezone = body.clientTimezone || 'UTC';

    // Get the booking
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Only the client who made the booking can checkout
    if (booking.clientId !== userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'NOT_AUTHORIZED', message: 'You can only checkout your own bookings' },
        },
        { status: 403 }
      );
    }

    // Booking must be pending
    if (booking.status !== 'pending') {
      return Response.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Booking is already ${booking.status}. Only pending bookings can be checked out.`,
          },
        },
        { status: 400 }
      );
    }

    // Get client email
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return Response.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Get coach profile with Stripe info
    const coachResult = await db
      .select({
        userId: coachProfiles.userId,
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
      return Response.json(
        { success: false, error: { code: 'COACH_NOT_FOUND', message: 'Coach not found' } },
        { status: 404 }
      );
    }

    const coach = coachResult[0];

    // Coach must have Stripe set up
    if (!coach.stripeAccountId || !coach.stripeOnboardingComplete) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'STRIPE_NOT_CONFIGURED',
            message: 'This coach has not set up payments yet. Please contact them directly.',
          },
        },
        { status: 400 }
      );
    }

    const sessionType = booking.sessionType as BookingSessionType;

    // Calculate platform fee (10%)
    const platformFeeAmount = Math.round(sessionType.price * 0.1);

    // Format date/time for Stripe description
    const sessionDate = formatDateLong(booking.startTime);
    const sessionTime = formatTime(booking.startTime);

    // Build success/cancel URLs
    // For mobile, these redirect back to the app; for web, to the success page
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${appUrl}/coaches/${coach.slug}/book/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${appUrl}/coaches/${coach.slug}`;

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
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
        clientTimezone,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!checkoutSession.url) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'CHECKOUT_FAILED',
            message: 'Failed to create checkout session',
          },
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      checkoutUrl: checkoutSession.url,
      bookingId,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return Response.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create checkout session. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
