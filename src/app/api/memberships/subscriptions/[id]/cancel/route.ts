/**
 * @fileoverview POST /api/memberships/subscriptions/[id]/cancel
 *
 * Cancels a client's membership subscription.
 *
 * - Default (`immediate=false`): sets `cancel_at_period_end=true` on Stripe.
 *   The client keeps access until `current_period_end`, no new charge.
 * - `immediate=true`: cancels the Stripe subscription immediately. The
 *   client loses access; no proration/refund is issued by default.
 *
 * Only the client (owner of the subscription) can cancel through this
 * endpoint. Coach-initiated deactivation happens via `DELETE
 * /api/memberships/[id]` (soft-deactivate of the product; existing
 * subscriptions keep running).
 *
 * @module api/memberships/subscriptions/[id]/cancel
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { membershipSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { cancelSubscriptionSchema } from '@/lib/validators/memberships';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'membership-subscription-cancel');
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

  let payload: unknown = {};
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      payload = await request.json();
    } catch {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
        },
        { status: 400 }
      );
    }
  }

  const parsed = cancelSubscriptionSchema.safeParse(payload);
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

  const { immediate } = parsed.data;

  try {
    const existing = await db.query.membershipSubscriptions.findFirst({
      where: eq(membershipSubscriptions.id, subscriptionId),
    });

    if (!existing) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } },
        { status: 404 }
      );
    }

    if (existing.clientId !== userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this subscription' },
        },
        { status: 403 }
      );
    }

    if (existing.status === 'canceled') {
      return Response.json(
        {
          success: false,
          error: { code: 'ALREADY_CANCELED', message: 'Subscription is already canceled' },
        },
        { status: 409 }
      );
    }

    if (immediate) {
      await stripe.subscriptions.cancel(existing.stripeSubscriptionId);

      const [row] = await db
        .update(membershipSubscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
          cancelAtPeriodEnd: false,
        })
        .where(eq(membershipSubscriptions.id, subscriptionId))
        .returning();

      return Response.json({ success: true, data: { subscription: row } });
    }

    // Default: cancel at period end.
    await stripe.subscriptions.update(existing.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const [row] = await db
      .update(membershipSubscriptions)
      .set({ cancelAtPeriodEnd: true })
      .where(eq(membershipSubscriptions.id, subscriptionId))
      .returning();

    return Response.json({ success: true, data: { subscription: row } });
  } catch (error) {
    console.error('[memberships/subscriptions/[id]/cancel:POST]', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel subscription' },
      },
      { status: 500 }
    );
  }
}
