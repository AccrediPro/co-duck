/**
 * POST /api/subscriptions/portal
 *
 * Opens the Stripe Customer Portal so coaches can manage their billing.
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { coachSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const [sub] = await db
    .select({ stripeCustomerId: coachSubscriptions.stripeCustomerId })
    .from(coachSubscriptions)
    .where(eq(coachSubscriptions.coachId, userId))
    .limit(1);

  if (!sub?.stripeCustomerId) {
    return Response.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'No billing account found. Subscribe first.' },
      },
      { status: 404 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl}/dashboard/subscription`,
  });

  return Response.json({ success: true, data: { portalUrl: portalSession.url } });
}
