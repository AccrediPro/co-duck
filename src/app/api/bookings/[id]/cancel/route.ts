/**
 * @fileoverview Cancel Booking API
 *
 * Cancels a booking.
 *
 * @module api/bookings/[id]/cancel
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, users, transactions } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { CancellationEmail } from '@/lib/emails';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';
import { calculateRefundEligibility } from '@/lib/refunds';
import { stripe } from '@/lib/stripe';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/bookings/:id/cancel
 *
 * Cancels a booking.
 * User must be the coach or client of the booking.
 * Only pending or confirmed bookings can be cancelled.
 *
 * @param {string} id - Booking ID
 * @body {string} [reason] - Cancellation reason
 *
 * @returns {Object} Cancelled booking
 */
export async function POST(request: Request, { params }: RouteParams) {
  // Rate limit: 10 requests per minute
  const rl = rateLimit(request, WRITE_LIMIT, 'bookings-cancel');
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
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    if (isNaN(bookingId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid booking ID' } },
        { status: 400 }
      );
    }

    // Get booking with access check
    const booking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.id, bookingId),
        or(eq(bookings.coachId, userId), eq(bookings.clientId, userId))
      ),
    });

    if (!booking) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Check if booking can be cancelled
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_STATUS', message: 'This booking cannot be cancelled' },
        },
        { status: 400 }
      );
    }

    // Update booking
    const [cancelledBooking] = await db
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: reason || null,
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    // Process Stripe refund for confirmed bookings
    let refundAmountCents = 0;
    let refundStatus: 'full' | 'none' | 'error' = 'none';

    if (booking.status === 'confirmed') {
      const transaction = await db.query.transactions.findFirst({
        where: and(eq(transactions.bookingId, bookingId), eq(transactions.status, 'succeeded')),
      });

      if (transaction?.stripePaymentIntentId) {
        const isCoachCancel = userId === booking.coachId;

        // Coach cancellations always get full refund; client cancellations use time-based policy
        let eligibleAmount: number;
        if (isCoachCancel) {
          eligibleAmount = transaction.amountCents;
        } else {
          const eligibility = calculateRefundEligibility(
            booking.startTime,
            transaction.amountCents,
            24
          );
          eligibleAmount = eligibility.refundAmountCents;
        }

        if (eligibleAmount > 0) {
          try {
            await stripe.refunds.create({
              payment_intent: transaction.stripePaymentIntentId,
              amount: eligibleAmount,
              reason: isCoachCancel ? 'requested_by_customer' : 'requested_by_customer',
            });

            await db
              .update(transactions)
              .set({
                status: 'refunded',
                refundAmountCents: eligibleAmount,
              })
              .where(eq(transactions.id, transaction.id));

            refundAmountCents = eligibleAmount;
            refundStatus = 'full';
            console.log(`Refund of ${eligibleAmount} cents processed for booking ${bookingId}`);
          } catch (refundError) {
            console.error('Stripe refund failed:', refundError);
            refundStatus = 'error';
          }
        }
      }
    }

    // Notify both parties about the cancellation
    const isCoach = userId === booking.coachId;
    const otherPartyId = isCoach ? booking.clientId : booking.coachId;
    createNotification({
      userId: otherPartyId,
      type: 'booking_cancelled',
      title: 'Session cancelled',
      body: reason || `A session has been cancelled by the ${isCoach ? 'coach' : 'client'}.`,
      link: isCoach ? `/dashboard/my-sessions/${bookingId}` : `/dashboard/sessions/${bookingId}`,
    });

    // Send cancellation emails to both client and coach
    try {
      // Get coach and client user data
      const [coachUser, clientUser] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, booking.coachId) }),
        db.query.users.findFirst({ where: eq(users.id, booking.clientId) }),
      ]);

      if (coachUser && clientUser) {
        const sessionType = booking.sessionType as {
          name: string;
          duration: number;
          price: number;
        };
        const startTime = new Date(booking.startTime);

        const emailData = {
          coachName: coachUser.name || 'Coach',
          sessionType: sessionType.name,
          date: startTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          time: startTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          duration: sessionType.duration,
          price: sessionType.price / 100, // Convert cents to dollars
          refundAmount: refundAmountCents / 100,
          refundStatus: refundStatus === 'full' ? ('processed' as const) : ('pending' as const),
          cancelledBy: userId === booking.coachId ? ('coach' as const) : ('client' as const),
          reason: reason || undefined,
        };

        // Send email to client
        const clientEmailResult = await sendEmail({
          to: clientUser.email,
          subject: `Session Cancelled: ${sessionType.name} with ${emailData.coachName}`,
          react: CancellationEmail({
            ...emailData,
            unsubscribeUrl: getUnsubscribeUrl(booking.clientId, 'bookings'),
          }),
        });

        if (!clientEmailResult.success) {
          console.error(
            '[Booking] Failed to send cancellation email to client:',
            clientEmailResult.error
          );
        }

        // Send email to coach
        const coachEmailResult = await sendEmail({
          to: coachUser.email,
          subject: `Session Cancelled: ${sessionType.name} with ${clientUser.name || 'Client'}`,
          react: CancellationEmail({
            ...emailData,
            coachName: clientUser.name || 'Client', // For coach, show client name
            unsubscribeUrl: getUnsubscribeUrl(booking.coachId, 'bookings'),
          }),
        });

        if (!coachEmailResult.success) {
          console.error(
            '[Booking] Failed to send cancellation email to coach:',
            coachEmailResult.error
          );
        }
      }
    } catch (emailError) {
      // Log email errors but don't fail the cancellation
      console.error('[Booking] Error sending cancellation emails:', emailError);
    }

    return Response.json({
      success: true,
      data: {
        id: cancelledBooking.id,
        status: cancelledBooking.status,
        cancelledBy: cancelledBooking.cancelledBy,
        cancelledAt: cancelledBooking.cancelledAt,
        cancellationReason: cancelledBooking.cancellationReason,
        refund: {
          amountCents: refundAmountCents,
          status: refundStatus,
        },
      },
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel booking' } },
      { status: 500 }
    );
  }
}
