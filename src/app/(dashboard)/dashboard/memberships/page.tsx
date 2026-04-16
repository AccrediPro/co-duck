/**
 * @fileoverview Coach memberships dashboard page.
 *
 * Coach-only page at `/dashboard/memberships` where coaches can:
 * - See all of their memberships (active + deactivated)
 * - Create a new monthly membership offering
 * - View subscribers for each membership
 *
 * Non-coaches are redirected away. Coaches without Stripe Connect set up
 * see a gate pointing them to /dashboard/payments.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db';
import { users, coachProfiles, memberships, membershipSubscriptions } from '@/db/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CoachMembershipsManager } from '@/components/memberships/coach-memberships-manager';

export const metadata = {
  title: 'Memberships | AccrediPro CoachHub',
  description: 'Create and manage recurring coaching memberships',
};

export default async function CoachMembershipsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) redirect('/dashboard');

  if (user.role !== 'coach' && user.role !== 'admin') {
    redirect('/dashboard');
  }

  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, userId),
  });

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Memberships</CardTitle>
            <CardDescription>
              Offer clients a monthly recurring retainer instead of per-session bookings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You need to complete coach onboarding before creating memberships.
            </p>
            <Button asChild>
              <Link href="/onboarding/coach">Complete onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile.stripeAccountId) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Memberships</CardTitle>
            <CardDescription>
              Offer clients a monthly recurring retainer instead of per-session bookings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Stripe account first — memberships are billed monthly and need a
              destination for payouts.
            </p>
            <Button asChild>
              <Link href="/dashboard/payments">Set up payments</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = await db
    .select()
    .from(memberships)
    .where(eq(memberships.coachId, userId))
    .orderBy(desc(memberships.isActive), desc(memberships.monthlyPriceCents));

  // Count active subscribers per membership.
  const subscriberRows = await db
    .select({
      membershipId: membershipSubscriptions.membershipId,
      status: membershipSubscriptions.status,
    })
    .from(membershipSubscriptions)
    .where(eq(membershipSubscriptions.coachId, userId));

  const subscriberCounts: Record<number, number> = {};
  for (const r of subscriberRows) {
    if (r.status === 'active' || r.status === 'past_due') {
      subscriberCounts[r.membershipId] = (subscriberCounts[r.membershipId] ?? 0) + 1;
    }
  }

  const initialMemberships = rows.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    monthlyPriceCents: m.monthlyPriceCents,
    currency: m.currency,
    sessionsPerPeriod: m.sessionsPerPeriod,
    includesMessaging: m.includesMessaging,
    isActive: m.isActive,
    activeSubscribers: subscriberCounts[m.id] ?? 0,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Memberships</CardTitle>
          <CardDescription>
            Create monthly retainers that clients can subscribe to. Includes a fixed number of
            sessions per period plus optional unlimited messaging.
          </CardDescription>
        </CardHeader>
      </Card>

      <CoachMembershipsManager
        initialMemberships={initialMemberships}
        defaultCurrency={(profile.currency ?? 'usd').toLowerCase()}
      />
    </div>
  );
}
