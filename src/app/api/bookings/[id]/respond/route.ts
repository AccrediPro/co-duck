/**
 * @fileoverview Accept/Reject Booking API
 *
 * Allows coaches to accept or reject pending booking requests.
 * When a client books and pays, the booking stays "pending" until
 * the coach explicitly accepts or rejects it here.
 *
 * - Accept: confirms booking, sends confirmation email, syncs calendar
 * - Reject: cancels booking, issues full Stripe refund, sends rejection email
 *
 * @module api/bookings/[id]/respond
 */

import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { db } from '@/db';
import { bookings, users, transactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { BookingConfirmationEmail, CancellationEmail } from '@/lib/emails';
import { sendEmailWithPreferences } from '@/lib/emails/send-with-preferences';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';
import { stripe } from '@/lib/stripe';
import { createNotification } from '@/lib/notifications';
import { syncBookingToCalendar } from '@/lib/google-calendar-sync';
import { getOrCreateConversationInternal, sendSystemMessage } from '@/lib/conversations';
import { format } from 'date-fns';
import type { BookingSessionType } from '@/db/schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const respondSchema = z.object({
  action: z.enum(['accept', 'reject']),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/bookings/:id/respond
 *
 * Coach accepts or rejects a pending booking request.
 *
 * @body {string} action - "accept" or "reject"
 * @body {string} [reason] - Rejection reason (optional, max 500 chars)
 *
 * @returns Booking response result
 */
export async function POST(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'bookings-respond');
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

    // Parse and validate request body
    const body = await request.json().catch(() => null);
    const parsed = respondSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((e) => e.message).join(', '),
          },
        },
        { status: 400 }
      );
    }

    const { action, reason } = parsed.data;

    // Get booking — only the coach can respond
    const booking = await db.query.bookings.findFirst({
      where: and(eq(bookings.id, bookingId), eq(bookings.coachId, userId)),
    });

    if (!booking) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Only pending bookings can be accepted/rejected
    if (booking.status !== 'pending') {
      return Response.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Booking is '${booking.status}', only 'pending' bookings can be accepted or rejected`,
          },
        },
        { status: 400 }
      );
    }

    // Check for a succeeded transaction (paid bookings have one, free bookings don't)
    const transaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.bookingId, bookingId), eq(transactions.status, 'succeeded')),
    });

    const sessionType = booking.sessionType as BookingSessionType;
    const isFreeBooking = sessionType?.price === 0;

    // For paid bookings, require a succeeded transaction
    if (!isFreeBooking && !transaction) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'NO_PAYMENT',
            message: 'No successful payment found for this booking',
          },
        },
        { status: 400 }
      );
    }

    // Get user data for emails and notifications
    const [coachUser, clientUser] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, booking.coachId) }),
      db.query.users.findFirst({ where: eq(users.id, booking.clientId) }),
    ]);

    const sessionName = sessionType?.name || 'Coaching session';
    const formattedDate = format(booking.startTime, 'EEEE, MMMM d, yyyy');
    const formattedTime = format(booking.startTime, 'h:mm a');

    if (action === 'accept') {
      return await handleAccept({
        bookingId,
        booking,
        coachUser,
        clientUser,
        sessionType,
        sessionName,
        formattedDate,
        formattedTime,
      });
    } else {
      return await handleReject({
        bookingId,
        booking,
        transaction,
        coachUser,
        clientUser,
        sessionType,
        sessionName,
        formattedDate,
        formattedTime,
        reason,
        coachId: userId,
      });
    }
  } catch (error) {
    console.error('Error responding to booking:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to respond to booking' },
      },
      { status: 500 }
    );
  }
}

interface HandleParams {
  bookingId: number;
  booking: typeof bookings.$inferSelect;
  coachUser: (typeof users.$inferSelect) | undefined;
  clientUser: (typeof users.$inferSelect) | undefined;
  sessionType: BookingSessionType;
  sessionName: string;
  formattedDate: string;
  formattedTime: string;
}

interface HandleRejectParams extends HandleParams {
  transaction: (typeof transactions.$inferSelect) | null | undefined;
  reason?: string;
  coachId: string;
}

async function handleAccept({
  bookingId,
  booking,
  coachUser,
  clientUser,
  sessionType,
  sessionName,
  formattedDate,
  formattedTime,
}: HandleParams) {
  // Update booking status to confirmed
  const [updatedBooking] = await db
    .update(bookings)
    .set({ status: 'confirmed' })
    .where(eq(bookings.id, bookingId))
    .returning();

  console.log(`Booking ${bookingId} accepted by coach`);

  // Send confirmation email to client (preference-checked, non-blocking)
  if (clientUser?.email && coachUser) {
    sendEmailWithPreferences(
      booking.clientId,
      'bookings',
      clientUser.email,
      `Booking confirmed! ${sessionName} with ${coachUser.name || 'your coach'}`,
      BookingConfirmationEmail({
        coachName: coachUser.name || 'Your Coach',
        sessionType: sessionName,
        date: formattedDate,
        time: formattedTime,
        duration: sessionType?.duration || 60,
        price: (sessionType?.price || 0) / 100,
        unsubscribeUrl: getUnsubscribeUrl(booking.clientId, 'bookings'),
      })
    ).catch((err) => console.error('Failed to send booking confirmation email:', err));
  }

  // System message in conversation
  const conversationResult = await getOrCreateConversationInternal(
    booking.coachId,
    booking.clientId
  );
  if (conversationResult.success) {
    sendSystemMessage(
      conversationResult.conversationId,
      `Booking accepted: ${sessionName} on ${formattedDate} at ${formattedTime} is confirmed`,
      booking.coachId
    ).catch((err) => console.error('Failed to send accept system message:', err));
  }

  // Notifications
  createNotification({
    userId: booking.clientId,
    type: 'booking_confirmed',
    title: 'Booking confirmed',
    body: `${coachUser?.name || 'Your coach'} accepted your ${sessionName} booking.`,
    link: `/dashboard/my-sessions/${bookingId}`,
  });

  // Sync to Google Calendar now that booking is confirmed
  syncBookingToCalendar(bookingId).catch((err) => {
    console.error('Failed to sync booking to calendar after accept:', err);
  });

  return Response.json({
    success: true,
    data: {
      id: updatedBooking.id,
      status: updatedBooking.status,
      action: 'accepted',
    },
  });
}

async function handleReject({
  bookingId,
  booking,
  transaction,
  coachUser,
  clientUser,
  sessionType,
  sessionName,
  formattedDate,
  formattedTime,
  reason,
  coachId,
}: HandleRejectParams) {
  // Update booking status to cancelled
  const [updatedBooking] = await db
    .update(bookings)
    .set({
      status: 'cancelled',
      cancelledBy: coachId,
      cancelledAt: new Date(),
      cancellationReason: reason || 'Booking request declined by coach',
    })
    .where(eq(bookings.id, bookingId))
    .returning();

  console.log(`Booking ${bookingId} rejected by coach`);

  // Process full refund (coach rejected — client always gets full refund for paid bookings)
  let refundAmountCents = 0;
  let refundStatus: 'full' | 'error' = 'error';

  if (transaction?.stripePaymentIntentId) {
    try {
      await stripe.refunds.create({
        payment_intent: transaction.stripePaymentIntentId,
        amount: transaction.amountCents,
        reason: 'requested_by_customer',
        metadata: {
          bookingId: bookingId.toString(),
          cancelledBy: 'coach',
          action: 'rejected',
        },
      });

      await db
        .update(transactions)
        .set({
          status: 'refunded',
          refundAmountCents: transaction.amountCents,
        })
        .where(eq(transactions.id, transaction.id));

      refundAmountCents = transaction.amountCents;
      refundStatus = 'full';
      console.log(`Refund of ${transaction.amountCents} cents processed for rejected booking ${bookingId}`);
    } catch (stripeError) {
      console.error('Stripe refund failed for rejected booking:', stripeError);
    }
  }

  // Send rejection/cancellation email to client (preference-checked, non-blocking)
  if (clientUser?.email && coachUser) {
    sendEmailWithPreferences(
      booking.clientId,
      'bookings',
      clientUser.email,
      `Booking request declined: ${sessionName} with ${coachUser.name || 'coach'}`,
      CancellationEmail({
        coachName: coachUser.name || 'Your Coach',
        sessionType: sessionName,
        date: formattedDate,
        time: formattedTime,
        duration: sessionType?.duration || 60,
        price: (sessionType?.price || 0) / 100,
        refundAmount: refundAmountCents / 100,
        refundStatus: refundStatus === 'full' ? 'processed' : 'pending',
        cancelledBy: 'coach',
        reason: reason || 'The coach was unable to accommodate this booking request.',
        unsubscribeUrl: getUnsubscribeUrl(booking.clientId, 'bookings'),
      })
    ).catch((err) => console.error('Failed to send rejection email:', err));
  }

  // System message in conversation
  const isFreeSession = sessionType?.price === 0;
  const refundNote = isFreeSession ? '' : ' A full refund has been issued.';
  const conversationResult = await getOrCreateConversationInternal(
    booking.coachId,
    booking.clientId
  );
  if (conversationResult.success) {
    const reasonText = reason ? ` Reason: ${reason}` : '';
    sendSystemMessage(
      conversationResult.conversationId,
      `Booking request declined: ${sessionName} on ${formattedDate} at ${formattedTime}.${reasonText}${refundNote}`,
      booking.coachId
    ).catch((err) => console.error('Failed to send reject system message:', err));
  }

  // Notifications
  createNotification({
    userId: booking.clientId,
    type: 'booking_cancelled',
    title: 'Booking request declined',
    body: `${coachUser?.name || 'The coach'} declined your ${sessionName} request.${reason ? ` Reason: ${reason}` : ''}${refundNote}`,
    link: `/dashboard/my-sessions/${bookingId}`,
  });

  return Response.json({
    success: true,
    data: {
      id: updatedBooking.id,
      status: updatedBooking.status,
      action: 'rejected',
      refund: {
        amountCents: refundAmountCents,
        status: refundStatus,
      },
    },
  });
}
