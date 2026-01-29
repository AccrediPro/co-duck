'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles, users } from '@/db';
import { eq } from 'drizzle-orm';
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

    const isComplete = account.details_submitted && account.charges_enabled;
    const requiresAction =
      !account.details_submitted || account.requirements?.currently_due?.length;

    // Update database if onboarding is now complete
    if (isComplete && !profile.stripeOnboardingComplete) {
      await db
        .update(coachProfiles)
        .set({ stripeOnboardingComplete: true })
        .where(eq(coachProfiles.userId, userId));
    }

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
