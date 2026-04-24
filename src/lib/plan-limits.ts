/**
 * Plan limits enforcement for Co-duck tiered SaaS (P0-07).
 *
 * Returns whether an action is allowed given the coach's current subscription.
 * All DB reads are lightweight single-row lookups on coach_subscriptions.
 */

import { db } from '@/db';
import { coachSubscriptions, packagePurchases, packages } from '@/db/schema';
import { and, count, eq } from 'drizzle-orm';

export type PlanId = 'starter' | 'pro' | 'scale';

export const PLATFORM_PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    priceMonthlyCents: 3900,
    priceYearlyCents: 39000,
    features: [
      'Up to 50 clients',
      '10% transaction fee',
      'Basic booking + payments',
      'Email support',
      'AccrediPro CoachHub branding',
    ],
    limits: { maxClients: 50, maxPackages: 3, aiNotesPerMonth: 10 },
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    priceMonthlyCents: 7900,
    priceYearlyCents: 79000,
    features: [
      'Unlimited clients',
      '5% transaction fee',
      'AI Session Notes (100/mo)',
      'Custom intake forms',
      'Memberships + packages',
      'Priority support',
      'Remove AccrediPro CoachHub branding',
    ],
    limits: { maxClients: -1, maxPackages: -1, aiNotesPerMonth: 100 },
  },
  {
    id: 'scale' as const,
    name: 'Scale',
    priceMonthlyCents: 14900,
    priceYearlyCents: 149000,
    features: [
      'Everything in Pro',
      '3% transaction fee',
      'AI Session Notes unlimited',
      'Multi-coach team (up to 3)',
      'White-label booking widget',
      'API access',
      'Dedicated success manager',
    ],
    limits: { maxClients: -1, maxPackages: -1, aiNotesPerMonth: -1, teamSeats: 3 },
  },
] as const;

export function getPlanById(planId: string) {
  return PLATFORM_PLANS.find((p) => p.id === planId) ?? PLATFORM_PLANS[0];
}

/** Get the platform fee rate for a coach (0.10, 0.05, or 0.03). */
export async function getCoachPlatformFeeRate(coachId: string): Promise<number> {
  const [sub] = await db
    .select({ planId: coachSubscriptions.planId, status: coachSubscriptions.status })
    .from(coachSubscriptions)
    .where(eq(coachSubscriptions.coachId, coachId))
    .limit(1);

  if (!sub || sub.status === 'canceled' || sub.status === 'incomplete') return 0.1;

  switch (sub.planId) {
    case 'pro':
      return 0.05;
    case 'scale':
      return 0.03;
    default:
      return 0.1;
  }
}

export interface LimitResult {
  allowed: boolean;
  limit: number;
  current: number;
  reason?: string;
}

/** Check whether a coach can create another published package. */
export async function canCreatePackage(coachId: string): Promise<LimitResult> {
  const [sub] = await db
    .select({ planId: coachSubscriptions.planId, status: coachSubscriptions.status })
    .from(coachSubscriptions)
    .where(eq(coachSubscriptions.coachId, coachId))
    .limit(1);

  const planId = sub?.status === 'active' || sub?.status === 'trialing' ? sub.planId : 'starter';
  const plan = getPlanById(planId);
  const maxPackages = plan.limits.maxPackages;

  if (maxPackages === -1) return { allowed: true, limit: -1, current: 0 };

  const [{ value }] = await db
    .select({ value: count() })
    .from(packages)
    .where(and(eq(packages.coachId, coachId), eq(packages.isPublished, true)));

  const current = value ?? 0;
  if (current >= maxPackages) {
    return {
      allowed: false,
      limit: maxPackages,
      current,
      reason: `Your ${plan.name} plan allows up to ${maxPackages} published packages. Upgrade to Pro for unlimited packages.`,
    };
  }
  return { allowed: true, limit: maxPackages, current };
}
