/**
 * @fileoverview Admin Platform Stats API
 *
 * Platform statistics dashboard data for admins.
 *
 * @module api/admin/stats
 */

import { db } from '@/db';
import { users, bookings, reviews, coachProfiles, conversations } from '@/db/schema';
import { eq, sql, gte, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/admin/stats
 *
 * Returns platform-wide statistics for the admin dashboard.
 *
 * @returns User counts, coach counts, booking breakdown, review stats, conversation stats
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'admin-stats');
  if (!rl.success) return rateLimitResponse(rl);

  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      userCountResult,
      newUsersThisMonthResult,
      activeCoachesResult,
      bookingCountResult,
      bookingsByStatusResult,
      reviewStatsResult,
      activeConversationsResult,
    ] = await Promise.all([
      // Total users
      db.select({ count: sql<number>`count(*)::int` }).from(users),

      // New users this month
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(gte(users.createdAt, startOfMonth)),

      // Active coaches (published + verified)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(coachProfiles)
        .where(
          and(eq(coachProfiles.isPublished, true), eq(coachProfiles.verificationStatus, 'verified'))
        ),

      // Total bookings
      db.select({ count: sql<number>`count(*)::int` }).from(bookings),

      // Bookings grouped by status
      db
        .select({
          status: bookings.status,
          count: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .groupBy(bookings.status),

      // Review stats: count + average rating
      db
        .select({
          count: sql<number>`count(*)::int`,
          averageRating: sql<number>`COALESCE(ROUND(AVG(${reviews.rating})::numeric, 1), 0)::float`,
        })
        .from(reviews),

      // Active conversations (with messages in last 30 days)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(gte(conversations.lastMessageAt, thirtyDaysAgo)),
    ]);

    const statusBreakdown: Record<string, number> = {};
    for (const row of bookingsByStatusResult) {
      statusBreakdown[row.status] = row.count;
    }

    return Response.json({
      success: true,
      data: {
        users: {
          total: userCountResult[0]?.count ?? 0,
          newThisMonth: newUsersThisMonthResult[0]?.count ?? 0,
        },
        coaches: {
          active: activeCoachesResult[0]?.count ?? 0,
        },
        bookings: {
          total: bookingCountResult[0]?.count ?? 0,
          byStatus: {
            pending: statusBreakdown['pending'] ?? 0,
            confirmed: statusBreakdown['confirmed'] ?? 0,
            completed: statusBreakdown['completed'] ?? 0,
            cancelled: statusBreakdown['cancelled'] ?? 0,
            no_show: statusBreakdown['no_show'] ?? 0,
          },
        },
        reviews: {
          total: reviewStatsResult[0]?.count ?? 0,
          averageRating: reviewStatsResult[0]?.averageRating ?? 0,
        },
        conversations: {
          activeLast30Days: activeConversationsResult[0]?.count ?? 0,
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
