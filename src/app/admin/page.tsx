/**
 * @fileoverview Admin Overview Page
 *
 * Main dashboard page for platform administrators showing key statistics
 * and recent activity.
 *
 * ## Statistics Displayed
 * - Total users (all roles)
 * - Total coaches (users with coach role)
 * - Total bookings (all statuses)
 * - Total revenue (from succeeded transactions)
 *
 * ## Recent Activity
 * - List of recent bookings with client, coach, and session details
 *
 * @module app/admin/page
 */

import { sql } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db, users, coachProfiles, bookings, transactions } from '@/db';
import { Users, UserCheck, Calendar, DollarSign, Clock } from 'lucide-react';

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches platform statistics from the database.
 *
 * Runs parallel queries to get:
 * - Total user count
 * - Total coach count (published profiles)
 * - Total booking count
 * - Total revenue (sum of succeeded transactions)
 *
 * @returns Object containing all platform statistics
 */
async function getPlatformStats() {
  try {
    // Run all queries in parallel for efficiency
    const [userCountResult, coachCountResult, bookingCountResult, revenueResult] =
      await Promise.all([
        // Total users
        db.select({ count: sql<number>`count(*)` }).from(users),

        // Total coaches (with published profiles)
        db
          .select({ count: sql<number>`count(*)` })
          .from(coachProfiles)
          .where(sql`${coachProfiles.isPublished} = true`),

        // Total bookings
        db.select({ count: sql<number>`count(*)` }).from(bookings),

        // Total revenue (sum of succeeded transactions)
        db
          .select({
            total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)`,
          })
          .from(transactions)
          .where(sql`${transactions.status} = 'succeeded'`),
      ]);

    return {
      totalUsers: Number(userCountResult[0]?.count) || 0,
      totalCoaches: Number(coachCountResult[0]?.count) || 0,
      totalBookings: Number(bookingCountResult[0]?.count) || 0,
      totalRevenue: Number(revenueResult[0]?.total) || 0,
    };
  } catch (error) {
    console.error('[Admin] Error fetching platform stats:', error);
    return {
      totalUsers: 0,
      totalCoaches: 0,
      totalBookings: 0,
      totalRevenue: 0,
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
 * Formats cents to a currency string.
 *
 * @param cents - Amount in cents
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Formats a date to a readable string.
 *
 * @param date - Date to format
 * @returns Formatted date string (e.g., "Jan 15, 2026 at 2:30 PM")
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground">Platform statistics and recent activity</p>
      </div>

      {/* Stats Grid */}
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

        {/* Total Coaches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coaches</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCoaches.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Published profiles</p>
          </CardContent>
        </Card>

        {/* Total Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Sessions booked</p>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From completed transactions</p>
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
                    <p>{formatDate(booking.startTime)}</p>
                    <p className="text-xs">Booked {formatDate(booking.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
