/**
 * @fileoverview Admin Overview Page
 *
 * Main dashboard page for platform administrators showing key statistics
 * and recent activity.
 *
 * ## Statistics Displayed
 * - Total users (all roles)
 * - New users this month
 * - Active coaches (published + verified)
 * - Total reviews with average rating
 * - Total sessions with status breakdown
 * - Active conversations (last 30 days)
 *
 * ## Recent Activity
 * - List of recent bookings with client, coach, and session details
 *
 * @module app/admin/page
 */

import { sql, and, eq, gte } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db, users, coachProfiles, bookings, reviews, conversations } from '@/db';
import { formatDateTime } from '@/lib/date-utils';

// This page queries the DB at request time; skip static prerender (CI has no DB).
export const dynamic = 'force-dynamic';
import { Users, UserCheck, Calendar, Star, MessageSquare, UserPlus, Clock } from 'lucide-react';

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches platform statistics from the database.
 *
 * Runs parallel queries to get:
 * - Total user count
 * - New users this month
 * - Active coach count (published + verified)
 * - Total booking count with status breakdown
 * - Review count and average rating
 * - Active conversations (last 30 days)
 *
 * @returns Object containing all platform statistics
 */
async function getPlatformStats() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for efficiency
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
      db.select({ count: sql<number>`count(*)` }).from(users),

      // New users this month
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(gte(users.createdAt, startOfMonth)),

      // Active coaches (published + verified)
      db
        .select({ count: sql<number>`count(*)` })
        .from(coachProfiles)
        .where(
          and(eq(coachProfiles.isPublished, true), eq(coachProfiles.verificationStatus, 'verified'))
        ),

      // Total bookings
      db.select({ count: sql<number>`count(*)` }).from(bookings),

      // Bookings grouped by status
      db
        .select({
          status: bookings.status,
          count: sql<number>`count(*)`,
        })
        .from(bookings)
        .groupBy(bookings.status),

      // Review stats: count + average rating
      db
        .select({
          count: sql<number>`count(*)`,
          averageRating: sql<number>`COALESCE(ROUND(AVG(${reviews.rating})::numeric, 1), 0)`,
        })
        .from(reviews),

      // Active conversations (with messages in last 30 days)
      db
        .select({ count: sql<number>`count(*)` })
        .from(conversations)
        .where(gte(conversations.lastMessageAt, thirtyDaysAgo)),
    ]);

    const statusBreakdown: Record<string, number> = {};
    for (const row of bookingsByStatusResult) {
      statusBreakdown[row.status] = Number(row.count) || 0;
    }

    return {
      totalUsers: Number(userCountResult[0]?.count) || 0,
      newUsersThisMonth: Number(newUsersThisMonthResult[0]?.count) || 0,
      activeCoaches: Number(activeCoachesResult[0]?.count) || 0,
      totalBookings: Number(bookingCountResult[0]?.count) || 0,
      bookingsByStatus: {
        pending: statusBreakdown['pending'] ?? 0,
        confirmed: statusBreakdown['confirmed'] ?? 0,
        completed: statusBreakdown['completed'] ?? 0,
        cancelled: statusBreakdown['cancelled'] ?? 0,
        no_show: statusBreakdown['no_show'] ?? 0,
      },
      totalReviews: Number(reviewStatsResult[0]?.count) || 0,
      averageRating: Number(reviewStatsResult[0]?.averageRating) || 0,
      activeConversations: Number(activeConversationsResult[0]?.count) || 0,
    };
  } catch (error) {
    console.error('[Admin] Error fetching platform stats:', error);
    return {
      totalUsers: 0,
      newUsersThisMonth: 0,
      activeCoaches: 0,
      totalBookings: 0,
      bookingsByStatus: {
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      },
      totalReviews: 0,
      averageRating: 0,
      activeConversations: 0,
    };
  }
}

/**
 * Fetches recent bookings with coach and client information.
 *
 * @param limit - Maximum number of bookings to return (default: 10)
 * @returns Array of recent bookings with related user data
 */
async function getRecentBookings(limit: number = 10) {
  try {
    const recentBookings = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        startTime: bookings.startTime,
        sessionType: bookings.sessionType,
        createdAt: bookings.createdAt,
        coachId: bookings.coachId,
        clientId: bookings.clientId,
      })
      .from(bookings)
      .orderBy(sql`${bookings.createdAt} DESC`)
      .limit(limit);

    // Fetch user names for coaches and clients
    const userIds = Array.from(new Set(recentBookings.flatMap((b) => [b.coachId, b.clientId])));

    if (userIds.length === 0) {
      return [];
    }

    const userRecords = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(sql`${users.id} IN ${userIds}`);

    const userMap = new Map(userRecords.map((u) => [u.id, u]));

    return recentBookings.map((booking) => ({
      ...booking,
      coach: userMap.get(booking.coachId) || { name: 'Unknown', email: '' },
      client: userMap.get(booking.clientId) || { name: 'Unknown', email: '' },
    }));
  } catch (error) {
    console.error('[Admin] Error fetching recent bookings:', error);
    return [];
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Returns badge variant based on booking status.
 *
 * @param status - Booking status
 * @returns Badge variant for the status
 */
function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'confirmed':
      return 'default';
    case 'completed':
      return 'secondary';
    case 'cancelled':
    case 'no_show':
      return 'destructive';
    default:
      return 'outline';
  }
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

/**
 * Admin Overview Page
 *
 * Displays platform statistics and recent booking activity.
 * Only accessible to users with admin role (enforced by layout).
 *
 * @returns Admin overview page with stats and recent bookings
 */
export default async function AdminOverviewPage() {
  // Fetch data in parallel
  const [stats, recentBookings] = await Promise.all([getPlatformStats(), getRecentBookings(10)]);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Page Header */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Admin Dashboard</CardTitle>
          <CardDescription>Platform overview and management</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {/* Stats Grid — Row 1 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Users */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Registered on the platform</p>
            </CardContent>
          </Card>

          {/* New Users This Month */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Users This Month</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.newUsersThisMonth.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Signed up this month</p>
            </CardContent>
          </Card>

          {/* Active Coaches */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Coaches</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeCoaches.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Published &amp; verified</p>
            </CardContent>
          </Card>

          {/* Total Reviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reviews</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReviews.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {stats.averageRating > 0
                  ? `${stats.averageRating.toFixed(1)} avg rating`
                  : 'No ratings yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Grid — Row 2: Sessions & Conversations */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Total Sessions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBookings.toLocaleString()}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stats.bookingsByStatus.confirmed > 0 && (
                  <Badge variant="default" className="text-xs">
                    {stats.bookingsByStatus.confirmed} confirmed
                  </Badge>
                )}
                {stats.bookingsByStatus.completed > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {stats.bookingsByStatus.completed} completed
                  </Badge>
                )}
                {stats.bookingsByStatus.pending > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {stats.bookingsByStatus.pending} pending
                  </Badge>
                )}
                {stats.bookingsByStatus.cancelled > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {stats.bookingsByStatus.cancelled} cancelled
                  </Badge>
                )}
                {stats.bookingsByStatus.no_show > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {stats.bookingsByStatus.no_show} no-show
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Conversations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeConversations.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">With messages in the last 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Bookings */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
            <CardDescription>Latest session bookings on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">No bookings yet</p>
                <p className="text-xs text-muted-foreground">
                  Bookings will appear here as they are created
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {(booking.sessionType as { name?: string })?.name || 'Session'}
                        </span>
                        <Badge variant={getStatusVariant(booking.status)}>{booking.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">
                          {booking.client.name || booking.client.email}
                        </span>
                        {' with '}
                        <span className="font-medium">
                          {booking.coach.name || booking.coach.email}
                        </span>
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground sm:text-right">
                      <p>{formatDateTime(booking.startTime)}</p>
                      <p className="text-xs">Booked {formatDateTime(booking.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
