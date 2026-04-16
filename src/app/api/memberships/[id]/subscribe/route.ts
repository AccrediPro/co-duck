/**
 * @fileoverview POST /api/memberships/[id]/subscribe
 *
 * Initiates a Stripe Checkout Session in `subscription` mode so a client
 * can subscribe to a coach's membership. Platform takes a 10% application
 * fee on every renewal via `subscription_data.application_fee_percent`
 * (consistent with the one-time booking fee model).
 *
 * The returned `checkoutUrl` must be opened in the user's browser. On
 * completion, Stripe fires `customer.subscription.created` +
 * `invoice.payment_succeeded`, and our webhook creates the
 * `membership_subscriptions` row.
 *
 * @module api/memberships/[id]/subscribe
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { memberships, coachProfiles, users, membershipSubscriptions } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { subscribeToMembershipSchema } from '@/lib/validators/memberships';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Platform fee applied to every renewal, in percent. */
const APPLICATION_FEE_PERCENT = 10;

export async function POST(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'membership-subscribe');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { id: idParam } = await params;
  const membershipId = Number.parseInt(idParam, 10);
  if (!Number.isFinite(membershipId) || membershipId <= 0) {
    return Response.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid membership id' } },
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

  const parsed = subscribeToMembershipSchema.safeParse(payload);
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

  try {
    const membership = await db.query.memberships.findFirst({
      where: eq(memberships.id, membershipId),
    });

    if (!membership || !membership.isActive) {
      return Response.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Membership not found or no longer active' },
        },
        { status: 404 }
      );
    }

    if (!membership.stripePriceId) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'STRIPE_PRICE_MISSING',
            message: 'This membership is not available for purchase right now.',
          },
        },
        { status: 400 }
      );
    }

    // Prevent self-subscription.
    if (membership.coachId === userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'SELF_SUBSCRIBE', message: 'Cannot subscribe to your own membership' },
        },
        { status: 400 }
      );
    }

    // Block duplicate active subscriptions to the same coach.
    const alreadyActive = await db.query.membershipSubscriptions.findFirst({
      where: and(
        eq(membershipSubscriptions.clientId, userId),
        eq(membershipSubscriptions.coachId, membership.coachId),
        inArray(membershipSubscriptions.status, ['active', 'past_due', 'incomplete'] as const)
      ),
    });
    if (alreadyActive) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'ALREADY_SUBSCRIBED',
            message: 'You already have an active membership with this coach.',
          },
        },
        { status: 409 }
      );
    }

    const [clientUser, coachProfile] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, userId) }),
      db.query.coachProfiles.findFirst({
        where: eq(coachProfiles.userId, membership.coachId),
      }),
    ]);

    if (!clientUser) {
      return Response.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User record not found' } },
        { status: 404 }
      );
    }

    if (!coachProfile?.stripeAccountId) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'STRIPE_NOT_CONFIGURED',
            message: 'This coach has not set up payments yet.',
          },
        },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl =
      parsed.data.successUrl ??
      `${appUrl}/dashboard/my-memberships?checkout_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = parsed.data.cancelUrl ?? `${appUrl}/coaches/${coachProfile.slug}`;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: clientUser.email,
      line_items: [{ price: membership.stripePriceId, quantity: 1 }],
      subscription_data: {
        application_fee_percent: APPLICATION_FEE_PERCENT,
        transfer_data: {
          destination: coachProfile.stripeAccountId,
        },
        metadata: {
          membershipId: String(membership.id),
          coachId: membership.coachId,
          clientId: userId,
          productKind: 'membership',
        },
      },
      metadata: {
        membershipId: String(membership.id),
        coachId: membership.coachId,
        clientId: userId,
        productKind: 'membership',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!checkoutSession.url) {
      return Response.json(
        {
          success: false,
          error: { code: 'CHECKOUT_FAILED', message: 'Failed to create checkout session' },
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: { checkoutUrl: checkoutSession.url, checkoutSessionId: checkoutSession.id },
    });
  } catch (error) {
    console.error('[memberships/[id]/subscribe:POST]', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to start subscription checkout' },
      },
      { status: 500 }
    );
  }
}
