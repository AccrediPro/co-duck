/**
 * @fileoverview Admin Platform Stats API
 *
 * Revenue dashboard data for admins.
 *
 * @module api/admin/stats
 */

import { db } from '@/db';
import { transactions, users, bookings, reviews } from '@/db/schema';
import { eq, sql, gte, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/admin/stats
 *
 * Returns platform-wide statistics for the admin dashboard.
 *
 * @returns Revenue, user counts, booking counts, review stats
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'admin-stats');
  if (!rl.success) return rateLimitResponse(rl);

  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      revenueResult,
      revenueThisMonthResult,
      userCountResult,
      coachCountResult,
      bookingCountResult,
      completedBookingsResult,
      reviewCountResult,
    ] = await Promise.all([
      // Total revenue (succeeded transactions)
      db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)::int`,
          totalPlatformFees: sql<number>`COALESCE(SUM(${transactions.platformFeeCents}), 0)::int`,
          transactionCount: sql<number>`count(*)::int`,
        })
        .from(transactions)
        .where(eq(transactions.status, 'succeeded')),

      // Revenue last 30 days
      db
        .select({
          revenue: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)::int`,
          platformFees: sql<number>`COALESCE(SUM(${transactions.platformFeeCents}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(transactions)
        .where(
          and(eq(transactions.status, 'succeeded'), gte(transactions.createdAt, thirtyDaysAgo))
        ),

      // Total users
      db.select({ count: sql<number>`count(*)::int` }).from(users),

      // Total coaches
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.role, 'coach')),

      // Total bookings
      db.select({ count: sql<number>`count(*)::int` }).from(bookings),

      // Completed bookings
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookings)
        .where(eq(bookings.status, 'completed')),

      // Total reviews
      db.select({ count: sql<number>`count(*)::int` }).from(reviews),
    ]);

    return Response.json({
      success: true,
      data: {
        revenue: {
          totalCents: revenueResult[0]?.totalRevenue ?? 0,
          platformFeesCents: revenueResult[0]?.totalPlatformFees ?? 0,
          transactionCount: revenueResult[0]?.transactionCount ?? 0,
        },
        revenueThisMonth: {
          totalCents: revenueThisMonthResult[0]?.revenue ?? 0,
          platformFeesCents: revenueThisMonthResult[0]?.platformFees ?? 0,
          count: revenueThisMonthResult[0]?.count ?? 0,
        },
        users: {
          total: userCountResult[0]?.count ?? 0,
          coaches: coachCountResult[0]?.count ?? 0,
        },
        bookings: {
          total: bookingCountResult[0]?.count ?? 0,
          completed: completedBookingsResult[0]?.count ?? 0,
        },
        reviews: {
          total: reviewCountResult[0]?.count ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stats' } },
      { status: 500 }
    );
  }
}
