/**
 * POST /api/packages/[id]/checkout
 *
 * Creates a Stripe Checkout session for purchasing a coaching package.
 * Uses destination charges: full amount goes to platform, 90% transferred to coach.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { packages, coachProfiles, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { getCoachPlatformFeeRate } from '@/lib/plan-limits';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const packageId = parseInt(id);
  if (isNaN(packageId)) {
    return Response.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid package ID' } },
      { status: 400 }
    );
  }

  const [pkg] = await db
    .select({
      id: packages.id,
      coachId: packages.coachId,
      title: packages.title,
      sessionCount: packages.sessionCount,
      sessionDuration: packages.sessionDuration,
      priceCents: packages.priceCents,
      validityDays: packages.validityDays,
      isPublished: packages.isPublished,
    })
    .from(packages)
    .where(eq(packages.id, packageId))
    .limit(1);

  if (!pkg || !pkg.isPublished) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Package not found' } },
      { status: 404 }
    );
  }

  if (pkg.coachId === userId) {
    return Response.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'You cannot buy your own package' } },
      { status: 400 }
    );
  }

  // Get coach's Stripe Connect account
  const [coachProfile] = await db
    .select({ stripeAccountId: coachProfiles.stripeAccountId })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, pkg.coachId))
    .limit(1);

  if (!coachProfile?.stripeAccountId) {
    return Response.json(
      {
        success: false,
        error: { code: 'COACH_NOT_READY', message: 'Coach has not set up payments yet' },
      },
      { status: 400 }
    );
  }

  const feeRate = await getCoachPlatformFeeRate(pkg.coachId);
  const platformFeeCents = Math.round(pkg.priceCents * feeRate);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: pkg.priceCents,
          product_data: {
            name: pkg.title,
            description: `${pkg.sessionCount} × ${pkg.sessionDuration}-min coaching sessions`,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: coachProfile.stripeAccountId },
    },
    metadata: {
      type: 'package',
      packageId: String(pkg.id),
      coachId: pkg.coachId,
      clientId: userId,
      feeRate: String(feeRate),
    },
    success_url: `${appUrl}/dashboard/my-packages?success=1&packageId=${pkg.id}`,
    cancel_url: `${appUrl}/dashboard/my-packages?cancelled=1`,
  });

  return Response.json({ success: true, data: { checkoutUrl: session.url } });
}
