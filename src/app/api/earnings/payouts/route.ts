/**
 * @fileoverview Coach Payouts API
 *
 * Fetches payout information from Stripe Connect for the authenticated coach.
 *
 * @module api/earnings/payouts
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { coachProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';

/**
 * GET /api/earnings/payouts
 *
 * Returns payout history and schedule for the authenticated coach.
 *
 * @query {number} [limit=10] - Number of payouts to return (max 50)
 *
 * @returns Payout list with balance and schedule info
 */
export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Get coach's Stripe Connect account ID
    const profile = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, userId),
    });

    if (!profile?.stripeAccountId) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'NO_STRIPE_ACCOUNT',
            message: 'No Stripe Connect account linked. Set up payouts first.',
          },
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));

    // Fetch payouts, balance, and account info in parallel
    const [payouts, balance, account] = await Promise.all([
      stripe.payouts.list({ limit }, { stripeAccount: profile.stripeAccountId }),
      stripe.balance.retrieve({ stripeAccount: profile.stripeAccountId }),
      stripe.accounts.retrieve(profile.stripeAccountId),
    ]);

    // Format balance
    const availableBalance = balance.available.map((b) => ({
      amount: b.amount,
      currency: b.currency,
    }));
    const pendingBalance = balance.pending.map((b) => ({
      amount: b.amount,
      currency: b.currency,
    }));

    // Format payouts
    const formattedPayouts = payouts.data.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
      created: new Date(p.created * 1000).toISOString(),
      method: p.method,
      description: p.description,
    }));

    // Payout schedule
    const schedule = account.settings?.payouts?.schedule;

    return Response.json({
      success: true,
      data: {
        balance: {
          available: availableBalance,
          pending: pendingBalance,
        },
        payoutSchedule: schedule
          ? {
              interval: schedule.delay_days === 0 ? 'instant' : schedule.interval,
              delayDays: schedule.delay_days,
              weeklyAnchor: schedule.weekly_anchor || null,
              monthlyAnchor: schedule.monthly_anchor || null,
            }
          : null,
        payouts: formattedPayouts,
        hasMore: payouts.has_more,
      },
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payouts' } },
      { status: 500 }
    );
  }
}
