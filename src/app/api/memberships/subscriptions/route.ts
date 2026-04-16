/**
 * @fileoverview GET /api/memberships/subscriptions
 *
 * Returns the authenticated user's membership subscriptions.
 *
 * - Clients get the memberships they subscribe to (any status).
 * - Coaches get the subscriptions sold on their memberships (optionally
 *   filtered by status via `?status=active`).
 *
 * @module api/memberships/subscriptions
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { membershipSubscriptions, memberships, users } from '@/db/schema';
import { eq, or, desc, and, inArray, type SQL } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

type SubscriptionStatus = (typeof membershipSubscriptions.status.enumValues)[number];
const VALID_STATUSES: readonly SubscriptionStatus[] = [
  'active',
  'past_due',
  'canceled',
  'incomplete',
];

export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'memberships-subscriptions-list');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role'); // 'client' | 'coach' | null
  const statusParam = searchParams.get('status');

  const conditions: SQL[] = [];

  if (role === 'client') {
    conditions.push(eq(membershipSubscriptions.clientId, userId));
  } else if (role === 'coach') {
    conditions.push(eq(membershipSubscriptions.coachId, userId));
  } else {
    const eitherRole = or(
      eq(membershipSubscriptions.clientId, userId),
      eq(membershipSubscriptions.coachId, userId)
    );
    if (eitherRole) conditions.push(eitherRole);
  }

  if (statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)) {
    conditions.push(eq(membershipSubscriptions.status, statusParam as SubscriptionStatus));
  }

  try {
    const rows = await db
      .select({
        sub: membershipSubscriptions,
        membership: memberships,
        coach: users,
      })
      .from(membershipSubscriptions)
      .innerJoin(memberships, eq(memberships.id, membershipSubscriptions.membershipId))
      .innerJoin(users, eq(users.id, membershipSubscriptions.coachId))
      .where(and(...conditions))
      .orderBy(desc(membershipSubscriptions.createdAt));

    // For coach role, also attach client info for display.
    const clientIds = Array.from(new Set(rows.map((r) => r.sub.clientId)));
    const clientUsers = clientIds.length
      ? await db
          .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
          .from(users)
          .where(inArray(users.id, clientIds))
      : [];
    const clientMap = new Map(clientUsers.map((u) => [u.id, u]));

    return Response.json({
      success: true,
      data: {
        subscriptions: rows.map(({ sub, membership, coach }) => ({
          id: sub.id,
          status: sub.status,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          sessionsRemainingThisPeriod: sub.sessionsRemainingThisPeriod,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          canceledAt: sub.canceledAt,
          createdAt: sub.createdAt,
          membership: {
            id: membership.id,
            name: membership.name,
            description: membership.description,
            monthlyPriceCents: membership.monthlyPriceCents,
            currency: membership.currency,
            sessionsPerPeriod: membership.sessionsPerPeriod,
            includesMessaging: membership.includesMessaging,
            isActive: membership.isActive,
          },
          coach: {
            id: coach.id,
            name: coach.name,
            avatarUrl: coach.avatarUrl,
          },
          client: clientMap.get(sub.clientId)
            ? {
                id: sub.clientId,
                name: clientMap.get(sub.clientId)?.name ?? null,
                email: clientMap.get(sub.clientId)?.email ?? null,
                avatarUrl: clientMap.get(sub.clientId)?.avatarUrl ?? null,
              }
            : null,
          isCoach: sub.coachId === userId,
        })),
      },
    });
  } catch (error) {
    console.error('[memberships/subscriptions:GET]', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch subscriptions' },
      },
      { status: 500 }
    );
  }
}
