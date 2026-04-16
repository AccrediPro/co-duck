/**
 * POST /api/subscriptions/checkout
 *
 * Creates a Stripe Checkout session for a coach to subscribe to a SaaS plan.
 * Includes 14-day free trial for new subscribers.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { coachSubscriptions, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { PLATFORM_PLANS, type PlanId } from '@/lib/plan-limits';
import { z } from 'zod';

// Stripe Price IDs — set these env vars in production
const STRIPE_PRICE_IDS: Record<string, { monthly: string; yearly: string }> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? 'price_starter_monthly',
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY ?? 'price_starter_yearly',
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_pro_monthly',
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? 'price_pro_yearly',
  },
  scale: {
    monthly: process.env.STRIPE_PRICE_SCALE_MONTHLY ?? 'price_scale_monthly',
    yearly: process.env.STRIPE_PRICE_SCALE_YEARLY ?? 'price_scale_yearly',
  },
};

const checkoutSchema = z.object({
  planId: z.enum(['starter', 'pro', 'scale']),
  billingInterval: z.enum(['monthly', 'yearly']),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 }
    );
  }

  const { planId, billingInterval } = parsed.data;
  const plan = PLATFORM_PLANS.find((p) => p.id === planId);
  if (!plan) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } },
      { status: 404 }
    );
  }

  // Get or reuse Stripe customer ID
  const [existingSub] = await db
    .select({ stripeCustomerId: coachSubscriptions.stripeCustomerId })
    .from(coachSubscriptions)
    .where(eq(coachSubscriptions.coachId, userId))
    .limit(1);

  const [userRecord] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let stripeCustomerId = existingSub?.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: userRecord?.email,
      name: userRecord?.name ?? undefined,
      metadata: { coachId: userId },
    });
    stripeCustomerId = customer.id;
  }

  const priceId = STRIPE_PRICE_IDS[planId][billingInterval];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: existingSub ? undefined : 14,
      metadata: { coachId: userId, planId, billingInterval },
    },
    metadata: { type: 'subscription', coachId: userId, planId, billingInterval },
    success_url: `${appUrl}/dashboard/subscription?success=1`,
    cancel_url: `${appUrl}/pricing`,
  });

  return Response.json({ success: true, data: { checkoutUrl: session.url } });
}
