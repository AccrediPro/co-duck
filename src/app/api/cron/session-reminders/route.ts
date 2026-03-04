/**
 * @fileoverview Session Reminders Cron Job Handler
 *
 * This endpoint is called by a cron scheduler (e.g., Vercel Cron, AWS EventBridge)
 * to send session reminder emails to clients and coaches.
 *
 * ## Reminders Sent
 * - 24-hour reminder: Sent 24 hours before the session
 * - 1-hour reminder: Sent 1 hour before the session
 *
 * ## Security
 * Protected by CRON_SECRET environment variable to prevent unauthorized calls.
 *
 * ## Recommended Cron Schedule
 * Run every 15 minutes to catch sessions within reminder windows.
 * Cron expression: "star/15 star star star star" (every 15 minutes)
 *
 * @module api/cron/session-reminders
 */

import { NextResponse } from 'next/server';
import { db, bookings, users } from '@/db';
import { transactions } from '@/db/schema';
import { eq, and, isNull, gte, lte } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { SessionReminderEmail, CancellationEmail } from '@/lib/emails';
import type { BookingSessionType } from '@/db/schema';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';
import { stripe } from '@/lib/stripe';
import { createNotification } from '@/lib/notifications';
import { sendPushNotification } from '@/lib/push-notifications';
import { getOrCreateConversationInternal, sendSystemMessage } from '@/lib/conversations';
import { formatDateLong, formatTime } from '@/lib/date-utils';

/**
 * Verifies the CRON_SECRET from the Authorization header.
 *
 * @param request - The incoming request
 * @returns true if valid, false otherwise
 */
function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('[SessionReminders] CRON_SECRET is not configured');
    return false;
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return false;
  }

  // Support both "Bearer <token>" and plain "<token>" formats
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  return token === cronSecret;
}

/**
 * GET /api/cron/session-reminders
 *
 * Finds upcoming confirmed bookings and sends reminder emails at:
 * - 24 hours before: If reminder24hSentAt is null and session is within 24-25 hours
 * - 1 hour before: If reminder1hSentAt is null and session is within 1-2 hours
 *
 * @param request - The incoming HTTP request
 * @returns JSON response with results
 */
export async function GET(request: Request) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results = {
    reminder24h: { sent: 0, failed: 0 },
    reminder1h: { sent: 0, failed: 0 },
    autoCancelled: { cancelled: 0, failed: 0 },
  };

  try {
    // Auto-cancel pending bookings that start within 12 hours
    const autoCancelResults = await autoCancelPendingBookings(now);
    results.autoCancelled = autoCancelResults;

    // Process 24-hour reminders
    const twentyFourHoursResults = await send24HourReminders(now);
    results.reminder24h = twentyFourHoursResults;

    // Process 1-hour reminders
    const oneHourResults = await send1HourReminders(now);
    results.reminder1h = oneHourResults;

    console.log(
      `[SessionReminders] Completed. ` +
        `Auto-cancelled: ${results.autoCancelled.cancelled} (${results.autoCancelled.failed} failed). ` +
        `24h: ${results.reminder24h.sent} sent, ${results.reminder24h.failed} failed. ` +
        `1h: ${results.reminder1h.sent} sent, ${results.reminder1h.failed} failed.`
    );

    return NextResponse.json({
      success: true,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SessionReminders] Error processing reminders:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        results,
      },
      { status: 500 }
    );
  }
}

/**
 * Auto-cancels pending bookings that start within 12 hours.
 *
 * When a booking is paid but the coach hasn't accepted it,
 * and the session is imminent (within 12 hours), we:
 * 1. Cancel the booking
 * 2. Issue a full Stripe refund
 * 3. Update the transaction to 'refunded'
 * 4. Send cancellation emails to both parties
 * 5. Send system message in conversation
 */
async function autoCancelPendingBookings(
  now: Date
): Promise<{ cancelled: number; failed: number }> {
  const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  // Find pending bookings starting within 12 hours
  const pendingBookings = await db
    .select({
      booking: bookings,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, 'pending'),
        lte(bookings.startTime, twelveHoursFromNow),
        gte(bookings.startTime, now)
      )
    );

  let cancelled = 0;
  let failed = 0;

  for (const { booking } of pendingBookings) {
    try {
      console.log(
        `[AutoCancel] Cancelling pending booking ${booking.id} (starts at ${booking.startTime.toISOString()})`
      );

      // Cancel the booking
      await db
        .update(bookings)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          cancellationReason: 'Auto-cancelled: coach did not respond before session time',
        })
        .where(eq(bookings.id, booking.id));

      // Find and refund the transaction
      const transaction = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.bookingId, booking.id),
          eq(transactions.status, 'succeeded')
        ),
      });

      if (transaction?.stripePaymentIntentId) {
        try {
          await stripe.refunds.create({
            payment_intent: transaction.stripePaymentIntentId,
            amount: transaction.amountCents,
            reason: 'requested_by_customer',
            metadata: {
              bookingId: booking.id.toString(),
              cancelledBy: 'system',
              action: 'auto_cancel_pending',
            },
          });

          await db
            .update(transactions)
            .set({
              status: 'refunded',
              refundAmountCents: transaction.amountCents,
            })
            .where(eq(transactions.id, transaction.id));

          console.log(
            `[AutoCancel] Refund of ${transaction.amountCents} cents processed for booking ${booking.id}`
          );
        } catch (stripeError) {
          console.error(
            `[AutoCancel] Stripe refund failed for booking ${booking.id}:`,
            stripeError
          );
        }
      }

      // Get user data for emails
      const [coachUser, clientUser] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, booking.coachId) }),
        db.query.users.findFirst({ where: eq(users.id, booking.clientId) }),
      ]);

      const sessionType = booking.sessionType as BookingSessionType;
      const sessionName = sessionType?.name || 'Coaching session';
      const formattedDate = formatDateLong(booking.startTime);
      const formattedTime = formatTime(booking.startTime);
      const refundAmount = transaction ? transaction.amountCents / 100 : 0;

      // Send cancellation email to client
      if (clientUser?.email && coachUser) {
        sendEmail({
          to: clientUser.email,
          subject: `Booking auto-cancelled: ${sessionName} with ${coachUser.name || 'coach'}`,
          react: CancellationEmail({
            coachName: coachUser.name || 'Your Coach',
            sessionType: sessionName,
            date: formattedDate,
            time: formattedTime,
            duration: sessionType?.duration || 60,
            price: (sessionType?.price || 0) / 100,
            refundAmount,
            refundStatus: 'processed',
            cancelledBy: 'coach',
            reason:
              'This booking was automatically cancelled because the coach did not respond in time. A full refund has been issued.',
            unsubscribeUrl: getUnsubscribeUrl(booking.clientId, 'bookings'),
          }),
        }).catch((err) =>
          console.error(`[AutoCancel] Failed to send cancellation email to client:`, err)
        );
      }

      // Send notification email to coach
      if (coachUser?.email && clientUser) {
        sendEmail({
          to: coachUser.email,
          subject: `Booking auto-cancelled: ${sessionName} with ${clientUser.name || 'client'}`,
          react: CancellationEmail({
            coachName: clientUser.name || 'Client',
            sessionType: sessionName,
            date: formattedDate,
            time: formattedTime,
            duration: sessionType?.duration || 60,
            price: (sessionType?.price || 0) / 100,
            cancelledBy: 'coach',
            reason:
              'This booking was automatically cancelled because it was not accepted before the session time. The client has received a full refund.',
            unsubscribeUrl: getUnsubscribeUrl(booking.coachId, 'bookings'),
          }),
        }).catch((err) =>
          console.error(`[AutoCancel] Failed to send cancellation email to coach:`, err)
        );
      }

      // System message in conversation
      const conversationResult = await getOrCreateConversationInternal(
        booking.coachId,
        booking.clientId
      );
      if (conversationResult.success) {
        sendSystemMessage(
          conversationResult.conversationId,
          `Booking auto-cancelled: ${sessionName} on ${formattedDate} at ${formattedTime} was cancelled because the coach did not respond in time. A full refund has been issued.`,
          booking.clientId
        ).catch((err) =>
          console.error(`[AutoCancel] Failed to send system message:`, err)
        );
      }

      // Notifications
      createNotification({
        userId: booking.clientId,
        type: 'booking_cancelled',
        title: 'Booking auto-cancelled',
        body: `Your ${sessionName} request was auto-cancelled because the coach did not respond. A full refund has been issued.`,
        link: `/dashboard/my-sessions/${booking.id}`,
      });

      createNotification({
        userId: booking.coachId,
        type: 'booking_cancelled',
        title: 'Booking auto-cancelled',
        body: `A ${sessionName} booking request was auto-cancelled because it was not accepted in time.`,
        link: `/dashboard/sessions/${booking.id}`,
      });

      cancelled++;
      console.log(`[AutoCancel] Booking ${booking.id} auto-cancelled successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[AutoCancel] Error auto-cancelling booking ${booking.id}: ${errorMessage}`
      );
      failed++;
    }
  }

  return { cancelled, failed };
}

/**
 * Sends 24-hour reminder emails for upcoming sessions.
 *
 * Finds bookings where:
 * - Status is 'confirmed'
 * - Start time is between 24 and 25 hours from now
 * - reminder24hSentAt is null (not already sent)
 */
async function send24HourReminders(now: Date): Promise<{ sent: number; failed: number }> {
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // Find bookings needing 24-hour reminder
  const bookingsNeeding24hReminder = await db
    .select({
      booking: bookings,
      coach: users,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.coachId, users.id))
    .where(
      and(
        eq(bookings.status, 'confirmed'),
        isNull(bookings.reminder24hSentAt),
        gte(bookings.startTime, twentyFourHoursFromNow),
        lte(bookings.startTime, twentyFiveHoursFromNow)
      )
    );

  let sent = 0;
  let failed = 0;

  for (const { booking, coach } of bookingsNeeding24hReminder) {
    try {
      // Get client email
      const clientResult = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, booking.clientId))
        .limit(1);

      if (clientResult.length === 0) {
        console.error(
          `[SessionReminders] Client ${booking.clientId} not found for booking ${booking.id}`
        );
        failed++;
        continue;
      }

      const client = clientResult[0];
      const sessionType = booking.sessionType as BookingSessionType;

      // Format date and time
      const dateStr = formatDateLong(booking.startTime);
      const timeStr = formatTime(booking.startTime);

      // Send email to client
      const clientEmailResult = await sendEmail({
        to: client.email,
        subject: `Reminder: Your session with ${coach.name || 'your coach'} is tomorrow`,
        react: SessionReminderEmail({
          coachName: coach.name || 'Your Coach',
          sessionType: sessionType.name,
          date: dateStr,
          time: timeStr,
          duration: sessionType.duration,
          meetingLink: booking.meetingLink || undefined,
          timeUntilSession: '24 hours',
          unsubscribeUrl: getUnsubscribeUrl(booking.clientId, 'reminders'),
        }),
      });

      // Also send reminder to coach
      await sendEmail({
        to: coach.email,
        subject: `Reminder: You have a session with ${client.name || 'a client'} tomorrow`,
        react: SessionReminderEmail({
          coachName: client.name || 'Your Client',
          sessionType: sessionType.name,
          date: dateStr,
          time: timeStr,
          duration: sessionType.duration,
          meetingLink: booking.meetingLink || undefined,
          timeUntilSession: '24 hours',
          unsubscribeUrl: getUnsubscribeUrl(booking.coachId, 'reminders'),
        }),
      });

      if (clientEmailResult.success) {
        // Update booking to mark reminder as sent
        await db
          .update(bookings)
          .set({ reminder24hSentAt: new Date() })
          .where(eq(bookings.id, booking.id));

        sendPushNotification(booking.coachId, {
          title: 'Session Tomorrow',
          body: `Your session with ${client.name || 'a client'} starts in 24 hours`,
          data: {
            type: 'session_reminder',
            link: `/dashboard/sessions/${booking.id}`,
          },
        });

        sendPushNotification(booking.clientId, {
          title: 'Session Tomorrow',
          body: `Your session with ${coach.name || 'your coach'} starts in 24 hours`,
          data: {
            type: 'session_reminder',
            link: `/dashboard/my-sessions/${booking.id}`,
          },
        });

        sent++;
        console.log(`[SessionReminders] 24h reminder sent for booking ${booking.id}`);
      } else {
        console.error(
          `[SessionReminders] Failed to send 24h reminder for booking ${booking.id}: ${clientEmailResult.error}`
        );
        failed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[SessionReminders] Error sending 24h reminder for booking ${booking.id}: ${errorMessage}`
      );
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Sends 1-hour reminder emails for imminent sessions.
 *
 * Finds bookings where:
 * - Status is 'confirmed'
 * - Start time is between 1 and 2 hours from now
 * - reminder1hSentAt is null (not already sent)
 */
async function send1HourReminders(now: Date): Promise<{ sent: number; failed: number }> {
  const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Find bookings needing 1-hour reminder
  const bookingsNeeding1hReminder = await db
    .select({
      booking: bookings,
      coach: users,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.coachId, users.id))
    .where(
      and(
        eq(bookings.status, 'confirmed'),
        isNull(bookings.reminder1hSentAt),
        gte(bookings.startTime, oneHourFromNow),
        lte(bookings.startTime, twoHoursFromNow)
      )
    );

  let sent = 0;
  let failed = 0;

  for (const { booking, coach } of bookingsNeeding1hReminder) {
    try {
      // Get client email
      const clientResult = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, booking.clientId))
        .limit(1);

      if (clientResult.length === 0) {
        console.error(
          `[SessionReminders] Client ${booking.clientId} not found for booking ${booking.id}`
        );
        failed++;
        continue;
      }

      const client = clientResult[0];
      const sessionType = booking.sessionType as BookingSessionType;

      // Format date and time
      const dateStr = formatDateLong(booking.startTime);
      const timeStr = formatTime(booking.startTime);

      // Send email to client
      const clientEmailResult = await sendEmail({
        to: client.email,
        subject: `Starting soon: Your session with ${coach.name || 'your coach'} is in 1 hour`,
        react: SessionReminderEmail({
          coachName: coach.name || 'Your Coach',
          sessionType: sessionType.name,
          date: dateStr,
          time: timeStr,
          duration: sessionType.duration,
          meetingLink: booking.meetingLink || undefined,
          timeUntilSession: '1 hour',
          unsubscribeUrl: getUnsubscribeUrl(booking.clientId, 'reminders'),
        }),
      });

      // Also send reminder to coach
      await sendEmail({
        to: coach.email,
        subject: `Starting soon: You have a session with ${client.name || 'a client'} in 1 hour`,
        react: SessionReminderEmail({
          coachName: client.name || 'Your Client',
          sessionType: sessionType.name,
          date: dateStr,
          time: timeStr,
          duration: sessionType.duration,
          meetingLink: booking.meetingLink || undefined,
          timeUntilSession: '1 hour',
          unsubscribeUrl: getUnsubscribeUrl(booking.coachId, 'reminders'),
        }),
      });

      if (clientEmailResult.success) {
        // Update booking to mark reminder as sent
        await db
          .update(bookings)
          .set({ reminder1hSentAt: new Date() })
          .where(eq(bookings.id, booking.id));

        sendPushNotification(booking.coachId, {
          title: 'Session Starting Soon',
          body: `Your session with ${client.name || 'a client'} starts in 1 hour`,
          data: {
            type: 'session_reminder',
            link: `/dashboard/sessions/${booking.id}`,
          },
        });

        sendPushNotification(booking.clientId, {
          title: 'Session Starting Soon',
          body: `Your session with ${coach.name || 'your coach'} starts in 1 hour`,
          data: {
            type: 'session_reminder',
            link: `/dashboard/my-sessions/${booking.id}`,
          },
        });

        sent++;
        console.log(`[SessionReminders] 1h reminder sent for booking ${booking.id}`);
      } else {
        console.error(
          `[SessionReminders] Failed to send 1h reminder for booking ${booking.id}: ${clientEmailResult.error}`
        );
        failed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[SessionReminders] Error sending 1h reminder for booking ${booking.id}: ${errorMessage}`
      );
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * POST /api/cron/session-reminders
 *
 * Alternative POST endpoint for cron services that use POST instead of GET.
 * Behavior is identical to GET.
 */
export async function POST(request: Request) {
  return GET(request);
}
