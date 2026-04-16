/**
 * @fileoverview POST /api/memberships/subscriptions/[id]/redeem
 *
 * Redeems one session from an active membership subscription: creates a
 * `pending` booking (awaiting coach approval, same flow as paid bookings)
 * and decrements `sessionsRemainingThisPeriod` atomically.
 *
 * No Stripe Checkout. No transaction record. The monthly membership fee
 * already covered the session.
 *
 * ## Preconditions
 * - Caller is the `clientId` of the subscription
 * - Subscription status is `active` (or `past_due` during grace)
 * - `sessionsRemainingThisPeriod > 0`
 * - Requested time slot is not in conflict with another booking
 *
 * @module api/memberships/subscriptions/[id]/redeem
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import {
  bookings,
  coachProfiles,
  membershipSubscriptions,
  memberships,
  users,
} from '@/db/schema';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { getOrCreateConversationInternal, sendSystemMessage } from '@/lib/conversations';
import { createNotification } from '@/lib/notifications';
import { formatDateLong, formatTime } from '@/lib/date-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const redeemSchema = z.object({
  sessionTypeId: z.string().min(1),
  startTime: z.string().datetime(),
  clientNotes: z.string().max(2000).optional(),
});

export async function POST(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'membership-subscription-redeem');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { id: idParam } = await params;
  const subscriptionId = Number.parseInt(idParam, 10);
  if (!Number.isFinite(subscriptionId) || subscriptionId <= 0) {
    return Response.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid subscription id' } },
      { status: 400 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } },
      { status: 400 }
    );
  }

  const parsed = redeemSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { sessionTypeId, startTime, clientNotes } = parsed.data;

  try {
    const subscription = await db.query.membershipSubscriptions.findFirst({
      where: eq(membershipSubscriptions.id, subscriptionId),
    });

    if (!subscription || subscription.clientId !== userId) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } },
        { status: 404 }
      );
    }

    // Allow `active`; `past_due` clients keep booking rights during the
    // grace window — Stripe + the webhook handle loss-of-access when the
    // subscription flips to `canceled`.
    if (subscription.status !== 'active' && subscription.status !== 'past_due') {
      return Response.json(
        {
          success: false,
          error: {
            code: 'SUBSCRIPTION_INACTIVE',
            message: 'This membership is not currently active.',
          },
        },
        { status: 400 }
      );
    }

    if (subscription.sessionsRemainingThisPeriod <= 0) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'NO_SESSIONS_REMAINING',
            message: 'You have no sessions remaining in this period.',
          },
        },
        { status: 400 }
      );
    }

    // Load coach's session types to resolve the chosen session
    const profile = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, subscription.coachId),
    });
    if (!profile) {
      return Response.json(
        { success: false, error: { code: 'COACH_NOT_FOUND', message: 'Coach not found' } },
        { status: 404 }
      );
    }

    const sessionType = (
      profile.sessionTypes as { id: string; name: string; duration: number; price: number }[] | null
    )?.find((st) => st.id === sessionTypeId);

    if (!sessionType) {
      return Response.json(
        {
          success: false,
          error: { code: 'SESSION_TYPE_NOT_FOUND', message: 'Session type not found' },
        },
        { status: 404 }
      );
    }

    const startDateTime = new Date(startTime);
    if (Number.isNaN(startDateTime.getTime())) {
      return Response.json(
        { success: false, error: { code: 'INVALID_TIME', message: 'Invalid start time' } },
        { status: 400 }
      );
    }
    const endDateTime = new Date(startDateTime.getTime() + sessionType.duration * 60_000);

    // Conflict check.
    const conflicting = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.coachId, subscription.coachId),
        inArray(bookings.status, ['pending', 'confirmed']),
        lt(bookings.startTime, endDateTime),
        gte(bookings.endTime, startDateTime)
      ),
    });

    if (conflicting) {
      return Response.json(
        {
          success: false,
          error: { code: 'TIME_CONFLICT', message: 'This time slot is no longer available' },
        },
        { status: 409 }
      );
    }

    // Atomic decrement: only decrement if still > 0. Returns the row if the
    // update succeeded — otherwise another request raced us to the last slot.
    const decremented = await db
      .update(membershipSubscriptions)
      .set({
        sessionsRemainingThisPeriod: sql`${membershipSubscriptions.sessionsRemainingThisPeriod} - 1`,
      })
      .where(
        and(
          eq(membershipSubscriptions.id, subscriptionId),
          gte(membershipSubscriptions.sessionsRemainingThisPeriod, 1)
        )
      )
      .returning();

    if (decremented.length === 0) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'NO_SESSIONS_REMAINING',
            message: 'You have no sessions remaining in this period.',
          },
        },
        { status: 400 }
      );
    }

    // Create the booking — marked `pending` to flow through coach approval
    // (mirrors the paid-booking flow in /api/bookings).
    const [newBooking] = await db
      .insert(bookings)
      .values({
        coachId: subscription.coachId,
        clientId: userId,
        sessionType: {
          name: sessionType.name,
          duration: sessionType.duration,
          price: sessionType.price,
        },
        startTime: startDateTime,
        endTime: endDateTime,
        status: 'pending',
        clientNotes: clientNotes || null,
        membershipSubscriptionId: subscriptionId,
      })
      .returning();

    // Notify the coach — system message + notification center.
    try {
      const [clientUser, coachUser, membership] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, userId) }),
        db.query.users.findFirst({ where: eq(users.id, subscription.coachId) }),
        db.query.memberships.findFirst({
          where: eq(memberships.id, subscription.membershipId),
        }),
      ]);

      const sessionName = sessionType.name;
      const formattedDate = formatDateLong(newBooking.startTime);
      const formattedTime = formatTime(newBooking.startTime);

      const conv = await getOrCreateConversationInternal(subscription.coachId, userId);
      if (conv.success) {
        await sendSystemMessage(
          conv.conversationId,
          `Membership session request: ${sessionName} on ${formattedDate} at ${formattedTime} — redeemed from "${membership?.name ?? 'membership'}" — awaiting coach approval`,
          userId
        );
      }

      createNotification({
        userId: subscription.coachId,
        type: 'booking_confirmed',
        title: 'New membership session request',
        body: `${clientUser?.name || 'A client'} has requested a ${sessionName} from their membership. Please accept or decline.`,
        link: `/dashboard/sessions/${newBooking.id}`,
      });

      createNotification({
        userId,
        type: 'booking_confirmed',
        title: 'Session request submitted',
        body: `Your ${sessionName} request has been submitted. ${coachUser?.name || 'Your coach'} will review it shortly.`,
        link: `/dashboard/my-sessions/${newBooking.id}`,
      });
    } catch (err) {
      // Notifications/messages are best-effort; don't fail the redemption.
      console.error('[memberships/redeem] notification error', err);
    }

    return Response.json(
      {
        success: true,
        data: {
          booking: {
            id: newBooking.id,
            status: newBooking.status,
            sessionType: newBooking.sessionType,
            startTime: newBooking.startTime,
            endTime: newBooking.endTime,
            membershipSubscriptionId: newBooking.membershipSubscriptionId,
          },
          sessionsRemainingThisPeriod: decremented[0].sessionsRemainingThisPeriod,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[memberships/subscriptions/[id]/redeem:POST]', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to redeem session' },
      },
      { status: 500 }
    );
  }
}
