'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles, users, transactions, bookings } from '@/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';

export type StripeOnboardingStatus = 'not_started' | 'pending' | 'complete';

export type GetPaymentsDataResult =
  | {
      success: true;
      data: {
        stripeAccountId: string | null;
        stripeOnboardingComplete: boolean;
        onboardingStatus: StripeOnboardingStatus;
        // Connect flags (mirror of Stripe, kept fresh by the account.updated webhook).
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
        // True when the coach may create invoices (requires charges_enabled).
        canInvoice: boolean;
      };
    }
  | { success: false; error: string };

export async function getPaymentsData(): Promise<GetPaymentsDataResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get coach profile
    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false, error: 'Coach profile not found' };
    }

    const profile = profiles[0];

    // Determine onboarding status
    let onboardingStatus: StripeOnboardingStatus = 'not_started';
    if (profile.stripeOnboardingComplete) {
      onboardingStatus = 'complete';
    } else if (profile.stripeAccountId) {
      onboardingStatus = 'pending';
    }

    return {
      success: true,
      data: {
        stripeAccountId: profile.stripeAccountId,
        stripeOnboardingComplete: profile.stripeOnboardingComplete,
        onboardingStatus,
        chargesEnabled: profile.chargesEnabled,
        payoutsEnabled: profile.payoutsEnabled,
        detailsSubmitted: profile.detailsSubmitted,
        canInvoice: !!profile.stripeAccountId && profile.chargesEnabled,
      },
    };
  } catch (error) {
    console.error('Error fetching payments data:', error);
    return { success: false, error: 'Failed to load payments data' };
  }
}

export type CreateStripeAccountResult =
  | { success: true; accountLinkUrl: string }
  | { success: false; error: string };

export async function createStripeConnectAccount(): Promise<CreateStripeAccountResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get coach profile and user data
    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return {
        success: false,
        error: 'Coach profile not found. Please complete onboarding first.',
      };
    }

    const profile = profiles[0];

    // Get user email
    const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (userRecords.length === 0) {
      return { success: false, error: 'User not found' };
    }

    const user = userRecords[0];

    // Get the host for return/refresh URLs
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    let accountId = profile.stripeAccountId;

    // Create Stripe Connect Express account if not exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        metadata: {
          coachUserId: userId,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      // Save the account ID to the database
      await db
        .update(coachProfiles)
        .set({ stripeAccountId: accountId })
        .where(eq(coachProfiles.userId, userId));
    }

    // Create Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/dashboard/payments?setup=refresh`,
      return_url: `${baseUrl}/dashboard/payments?setup=complete`,
      type: 'account_onboarding',
    });

    return { success: true, accountLinkUrl: accountLink.url };
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    return { success: false, error: 'Failed to start payment setup. Please try again.' };
  }
}

export type CheckStripeAccountStatusResult =
  | { success: true; isComplete: boolean; requiresAction: boolean }
  | { success: false; error: string };

export async function checkStripeAccountStatus(): Promise<CheckStripeAccountStatusResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get coach profile
    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false, error: 'Coach profile not found' };
    }

    const profile = profiles[0];

    if (!profile.stripeAccountId) {
      return { success: true, isComplete: false, requiresAction: false };
    }

    // Check account status with Stripe
    const account = await stripe.accounts.retrieve(profile.stripeAccountId);

    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;
    const detailsSubmitted = !!account.details_submitted;
    const isComplete = detailsSubmitted && chargesEnabled;
    const requiresAction =
      !account.details_submitted || account.requirements?.currently_due?.length;

    // Persist the fresh Connect flags (complements the account.updated webhook —
    // ensures the local mirror is up to date right after the coach returns from
    // onboarding, before any webhook may have landed). Only ever flips
    // stripeOnboardingComplete to true, never back to false.
    await db
      .update(coachProfiles)
      .set({
        chargesEnabled,
        payoutsEnabled,
        detailsSubmitted,
        ...(isComplete && !profile.stripeOnboardingComplete
          ? { stripeOnboardingComplete: true }
          : {}),
      })
      .where(eq(coachProfiles.userId, userId));

    return {
      success: true,
      isComplete: !!isComplete,
      requiresAction: !!requiresAction,
    };
  } catch (error) {
    console.error('Error checking Stripe account status:', error);
    return { success: false, error: 'Failed to check account status' };
  }
}

export type GenerateOnboardingLinkResult =
  | { success: true; url: string }
  | { success: false; error: string };

export async function generateOnboardingLink(): Promise<GenerateOnboardingLinkResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get coach profile
    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false, error: 'Coach profile not found' };
    }

    const profile = profiles[0];

    if (!profile.stripeAccountId) {
      return { success: false, error: 'No Stripe account found. Please start onboarding first.' };
    }

    // Get the host for return/refresh URLs
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Generate new Account Link
    const accountLink = await stripe.accountLinks.create({
      account: profile.stripeAccountId,
      refresh_url: `${baseUrl}/dashboard/payments?setup=refresh`,
      return_url: `${baseUrl}/dashboard/payments?setup=complete`,
      type: 'account_onboarding',
    });

    return { success: true, url: accountLink.url };
  } catch (error) {
    console.error('Error generating onboarding link:', error);
    return { success: false, error: 'Failed to generate onboarding link' };
  }
}

// Earnings and transactions types
export interface TransactionWithClient {
  id: number;
  bookingId: number | null;
  clientName: string | null;
  clientEmail: string | null;
  sessionType: string;
  amountCents: number;
  platformFeeCents: number;
  coachPayoutCents: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  createdAt: Date;
}

export interface EarningsData {
  totalEarnings: number; // in cents, all time succeeded
  thisMonthEarnings: number; // in cents, this month succeeded
  pendingPayouts: number; // in cents, pending transactions
  currency: string;
}

export type GetCoachEarningsResult =
  | {
      success: true;
      data: {
        earnings: EarningsData;
        transactions: TransactionWithClient[];
        totalCount: number;
        page: number;
        pageSize: number;
      };
    }
  | { success: false; error: string };

export async function getCoachEarnings(
  page: number = 1,
  pageSize: number = 10
): Promise<GetCoachEarningsResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get coach profile to verify user is a coach
    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false, error: 'Coach profile not found' };
    }

    const profile = profiles[0];

    // Calculate total earnings (all time, succeeded transactions)
    const totalEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.coachPayoutCents}), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.coachId, userId), eq(transactions.status, 'succeeded')));

    const totalEarnings = Number(totalEarningsResult[0]?.total || 0);

    // Calculate this month earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.coachPayoutCents}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.coachId, userId),
          eq(transactions.status, 'succeeded'),
          sql`${transactions.createdAt} >= ${startOfMonth.toISOString()}`
        )
      );

    const thisMonthEarnings = Number(thisMonthResult[0]?.total || 0);

    // Calculate pending payouts
    const pendingResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.coachPayoutCents}), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.coachId, userId), eq(transactions.status, 'pending')));

    const pendingPayouts = Number(pendingResult[0]?.total || 0);

    // Get total count for pagination
    const countResult = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(eq(transactions.coachId, userId));

    const totalCount = Number(countResult[0]?.count || 0);

    // Get paginated transactions with client info
    const offset = (page - 1) * pageSize;

    const transactionResults = await db
      .select({
        id: transactions.id,
        bookingId: transactions.bookingId,
        clientId: transactions.clientId,
        amountCents: transactions.amountCents,
        platformFeeCents: transactions.platformFeeCents,
        coachPayoutCents: transactions.coachPayoutCents,
        currency: transactions.currency,
        status: transactions.status,
        createdAt: transactions.createdAt,
        clientName: users.name,
        clientEmail: users.email,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.clientId, users.id))
      .where(eq(transactions.coachId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Get booking info for session types
    const transactionsWithSessionType: TransactionWithClient[] = await Promise.all(
      transactionResults.map(async (t) => {
        let sessionType = 'Session';
        if (t.bookingId) {
          const bookingResult = await db
            .select({ sessionType: bookings.sessionType })
            .from(bookings)
            .where(eq(bookings.id, t.bookingId))
            .limit(1);
          if (bookingResult[0]?.sessionType) {
            sessionType = bookingResult[0].sessionType.name;
          }
        }
        return {
          id: t.id,
          bookingId: t.bookingId,
          clientName: t.clientName,
          clientEmail: t.clientEmail,
          sessionType,
          amountCents: t.amountCents,
          platformFeeCents: t.platformFeeCents,
          coachPayoutCents: t.coachPayoutCents,
          currency: t.currency,
          status: t.status,
          createdAt: t.createdAt,
        };
      })
    );

    return {
      success: true,
      data: {
        earnings: {
          totalEarnings,
          thisMonthEarnings,
          pendingPayouts,
          currency: profile.currency || 'USD',
        },
        transactions: transactionsWithSessionType,
        totalCount,
        page,
        pageSize,
      },
    };
  } catch (error) {
    console.error('Error fetching coach earnings:', error);
    return { success: false, error: 'Failed to load earnings data' };
  }
}

export type GenerateStripeDashboardLinkResult =
  | { success: true; url: string }
  | { success: false; error: string };

export async function generateStripeDashboardLink(): Promise<GenerateStripeDashboardLinkResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get coach profile
    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false, error: 'Coach profile not found' };
    }

    const profile = profiles[0];

    if (!profile.stripeAccountId) {
      return { success: false, error: 'No Stripe account found' };
    }

    // Generate login link for Stripe Express Dashboard
    const loginLink = await stripe.accounts.createLoginLink(profile.stripeAccountId);

    return { success: true, url: loginLink.url };
  } catch (error) {
    console.error('Error generating Stripe dashboard link:', error);
    return { success: false, error: 'Failed to generate dashboard link' };
  }
}

/**
 * Why a coach currently cannot issue invoices.
 * - `no_stripe_account`: never started Connect onboarding.
 * - `onboarding_incomplete`: account exists but details not submitted.
 * - `charges_disabled`: details submitted but charges still not enabled
 *   (e.g. Stripe verification pending).
 */
export type InvoicingBlockedReason =
  | 'no_stripe_account'
  | 'onboarding_incomplete'
  | 'charges_disabled';

export type InvoicingEligibilityResult =
  | {
      success: true;
      canInvoice: boolean;
      reason?: InvoicingBlockedReason;
      /** A fresh Connect onboarding link to finish/re-link when blocked. */
      onboardingUrl?: string;
    }
  | { success: false; error: string };

/**
 * Connect gating for the invoicing feature.
 *
 * A coach may create invoices only when their connected account has
 * `charges_enabled = true` (Dave's binding Connect-hardening requirement).
 * When blocked because onboarding is incomplete or charges aren't enabled yet,
 * this returns a freshly generated account onboarding link so the UI can offer
 * a one-click re-link without a separate round-trip.
 *
 * The invoice-create route (Wave B2) and the Invoices tab (Wave B3) consume this
 * to decide whether to allow invoice creation.
 */
export async function getInvoicingEligibility(): Promise<InvoicingEligibilityResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false, error: 'Coach profile not found' };
    }

    const profile = profiles[0];

    if (!profile.stripeAccountId) {
      return { success: true, canInvoice: false, reason: 'no_stripe_account' };
    }

    if (profile.chargesEnabled) {
      return { success: true, canInvoice: true };
    }

    // Blocked → mint a fresh onboarding link so the coach can finish/re-link.
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const accountLink = await stripe.accountLinks.create({
      account: profile.stripeAccountId,
      refresh_url: `${baseUrl}/dashboard/payments?setup=refresh`,
      return_url: `${baseUrl}/dashboard/payments?setup=complete`,
      type: 'account_onboarding',
    });

    return {
      success: true,
      canInvoice: false,
      reason: profile.detailsSubmitted ? 'charges_disabled' : 'onboarding_incomplete',
      onboardingUrl: accountLink.url,
    };
  } catch (error) {
    console.error('Error checking invoicing eligibility:', error);
    return { success: false, error: 'Failed to check invoicing eligibility' };
  }
}
