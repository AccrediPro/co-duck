/**
 * @fileoverview Client "My Memberships" dashboard page.
 *
 * Lists the signed-in client's coaching subscriptions and exposes cancel /
 * renew-info actions. Also surfaces a post-Checkout success banner when
 * the user is redirected back here with `?checkout_session_id=…`.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { users, coachProfiles, memberships, membershipSubscriptions } from '@/db/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MyMembershipsList } from '@/components/memberships/my-memberships-list';

export const metadata = {
  title: 'My Memberships | AccrediPro CoachHub',
  description: 'Manage your coaching memberships',
};

interface PageProps {
  searchParams: Promise<{ checkout_session_id?: string }>;
}

export default async function MyMembershipsPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const params = await searchParams;
  const checkoutSessionId = params.checkout_session_id;

  // Load subscriptions with joined membership + coach info.
  const rows = await db
    .select({
      subscription: membershipSubscriptions,
      membership: memberships,
      coach: users,
      coachProfile: coachProfiles,
    })
    .from(membershipSubscriptions)
    .innerJoin(memberships, eq(memberships.id, membershipSubscriptions.membershipId))
    .innerJoin(users, eq(users.id, membershipSubscriptions.coachId))
    .leftJoin(coachProfiles, eq(coachProfiles.userId, membershipSubscriptions.coachId))
    .where(eq(membershipSubscriptions.clientId, userId))
    .orderBy(desc(membershipSubscriptions.createdAt));

  const subscriptions = rows.map(({ subscription, membership, coach, coachProfile }) => ({
    id: subscription.id,
    status: subscription.status,
    sessionsRemainingThisPeriod: subscription.sessionsRemainingThisPeriod,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    canceledAt: subscription.canceledAt?.toISOString() ?? null,
    membership: {
      id: membership.id,
      name: membership.name,
      description: membership.description,
      monthlyPriceCents: membership.monthlyPriceCents,
      currency: membership.currency,
      sessionsPerPeriod: membership.sessionsPerPeriod,
      includesMessaging: membership.includesMessaging,
    },
    coach: {
      id: coach.id,
      name: coach.name,
      slug: coachProfile?.slug ?? null,
      avatarUrl: coach.avatarUrl,
    },
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">My Memberships</CardTitle>
          <CardDescription>
            Monthly coaching retainers you’re subscribed to. Sessions renew at the start of every
            billing period.
          </CardDescription>
        </CardHeader>
      </Card>

      {checkoutSessionId && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardContent className="py-4">
            <p className="text-sm font-medium">
              🎉 Subscription confirmed! It may take a moment to appear below — refresh the page if
              you don’t see it yet.
            </p>
          </CardContent>
        </Card>
      )}

      <MyMembershipsList subscriptions={subscriptions} />
    </div>
  );
}
