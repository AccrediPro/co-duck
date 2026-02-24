/**
 * @fileoverview Coach Earnings API
 *
 * Returns earnings summary and breakdown for coaches.
 *
 * @module api/earnings
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { transactions, users } from '@/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

/**
 * GET /api/earnings
 *
 * Returns earnings summary for the authenticated coach.
 *
 * @query {string} [period] - Time period: "week", "month", "year", "all" (default: "month")
 * @query {string} [from] - Start date (ISO string, overrides period)
 * @query {string} [to] - End date (ISO string, overrides period)
 *
 * @returns Earnings summary with total, breakdown by client, and recent transactions
 */
export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // Verify user is a coach
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || user.role !== 'coach') {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Coach access required' } },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Calculate date range
    let fromDate: Date;
    let toDate = new Date();

    if (fromParam && toParam) {
      fromDate = new Date(fromParam);
      toDate = new Date(toParam);
    } else {
      switch (period) {
        case 'week':
          fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          fromDate = new Date(toDate.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          fromDate = new Date(0);
          break;
        case 'month':
        default:
          fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    const conditions = [
      eq(transactions.coachId, userId),
      eq(transactions.status, 'succeeded'),
      gte(transactions.createdAt, fromDate),
      lte(transactions.createdAt, toDate),
    ];

    // Get summary stats
    const [summaryResult, recentTransactions, clientBreakdown] = await Promise.all([
      db
        .select({
          totalEarnings: sql<number>`COALESCE(SUM(${transactions.coachPayoutCents}), 0)::int`,
          totalRevenue: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)::int`,
          platformFees: sql<number>`COALESCE(SUM(${transactions.platformFeeCents}), 0)::int`,
          transactionCount: sql<number>`count(*)::int`,
        })
        .from(transactions)
        .where(and(...conditions)),

      // Recent transactions (last 10)
      db
        .select({
          id: transactions.id,
          bookingId: transactions.bookingId,
          clientId: transactions.clientId,
          amountCents: transactions.amountCents,
          coachPayoutCents: transactions.coachPayoutCents,
          platformFeeCents: transactions.platformFeeCents,
          currency: transactions.currency,
          createdAt: transactions.createdAt,
          clientName: users.name,
        })
        .from(transactions)
        .leftJoin(users, eq(users.id, transactions.clientId))
        .where(and(...conditions))
        .orderBy(desc(transactions.createdAt))
        .limit(10),

      // Earnings by client
      db
        .select({
          clientId: transactions.clientId,
          clientName: users.name,
          totalEarnings: sql<number>`COALESCE(SUM(${transactions.coachPayoutCents}), 0)::int`,
          sessionCount: sql<number>`count(*)::int`,
        })
        .from(transactions)
        .leftJoin(users, eq(users.id, transactions.clientId))
        .where(and(...conditions))
        .groupBy(transactions.clientId, users.name)
        .orderBy(desc(sql`SUM(${transactions.coachPayoutCents})`)),
    ]);

    const summary = summaryResult[0];

    return Response.json({
      success: true,
      data: {
        period: { from: fromDate.toISOString(), to: toDate.toISOString() },
        summary: {
          totalEarningsCents: summary?.totalEarnings ?? 0,
          totalRevenueCents: summary?.totalRevenue ?? 0,
          platformFeesCents: summary?.platformFees ?? 0,
          transactionCount: summary?.transactionCount ?? 0,
        },
        recentTransactions: recentTransactions.map((t) => ({
          id: t.id,
          bookingId: t.bookingId,
          amountCents: t.amountCents,
          earningsCents: t.coachPayoutCents,
          feeCents: t.platformFeeCents,
          currency: t.currency,
          clientName: t.clientName,
          createdAt: t.createdAt,
        })),
        clientBreakdown: clientBreakdown.map((c) => ({
          clientId: c.clientId,
          clientName: c.clientName,
          totalEarningsCents: c.totalEarnings,
          sessionCount: c.sessionCount,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch earnings' } },
      { status: 500 }
    );
  }
}
