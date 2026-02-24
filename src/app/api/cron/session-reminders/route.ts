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
import { eq, and, isNull, gte, lte } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { SessionReminderEmail } from '@/lib/emails';
import type { BookingSessionType } from '@/db/schema';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';

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
  };

  try {
    // Process 24-hour reminders
    const twentyFourHoursResults = await send24HourReminders(now);
    results.reminder24h = twentyFourHoursResults;

    // Process 1-hour reminders
    const oneHourResults = await send1HourReminders(now);
    results.reminder1h = oneHourResults;

    console.log(
      `[SessionReminders] Completed. 24h: ${results.reminder24h.sent} sent, ${results.reminder24h.failed} failed. ` +
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
      const startDate = new Date(booking.startTime);
      const dateStr = startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeStr = startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

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
      const startDate = new Date(booking.startTime);
      const dateStr = startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeStr = startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

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
