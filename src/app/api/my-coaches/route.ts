/**
 * @fileoverview My Coaches API
 *
 * Returns the list of coaches a client has an active relationship with,
 * derived from confirmed/completed bookings.
 *
 * @module api/my-coaches
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, users, coachProfiles, programs } from '@/db/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/my-coaches
 *
 * Returns a paginated list of coaches the authenticated client has had
 * confirmed or completed bookings with, ordered by most recent booking.
 *
 * @query {number} [page=1]  - Page number (1-based)
 * @query {number} [limit=20] - Items per page (max 50)
 *
 * @returns {Object} Paginated coach list
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'my-coaches-list');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Count distinct coaches and get paginated rows in parallel using a subquery approach.
    // We aggregate first, then paginate at the SQL level — no .slice() needed.
    const [countResult, coachRows] = await Promise.all([
      db
        .select({ total: sql<number>`count(distinct ${bookings.coachId})::int` })
        .from(bookings)
        .where(
          and(
            eq(bookings.clientId, userId),
            inArray(bookings.status, ['confirmed', 'completed'])
          )
        ),
      db
        .select({
          coachId: bookings.coachId,
          lastBookingDate: sql<string>`max(${bookings.startTime})`.as('last_booking_date'),
          totalSessions: sql<number>`count(*)::int`.as('total_sessions'),
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.clientId, userId),
            inArray(bookings.status, ['confirmed', 'completed'])
          )
        )
        .groupBy(bookings.coachId)
        .orderBy(desc(sql`max(${bookings.startTime})`))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.total ?? 0;

    if (coachRows.length === 0) {
      return Response.json({
        success: true,
        data: {
          coaches: [],
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    }

    const coachIds = coachRows.map((r) => r.coachId);

    // Batch-fetch related data — no N+1
    const [coachUsers, coachProfilesData, programCounts] = await Promise.all([
      db.select().from(users).where(inArray(users.id, coachIds)),
      db.select().from(coachProfiles).where(inArray(coachProfiles.userId, coachIds)),
      db
        .select({
          coachId: programs.coachId,
          count: sql<number>`count(*)::int`.as('count'),
        })
        .from(programs)
        .where(
          and(
            eq(programs.clientId, userId),
            inArray(programs.coachId, coachIds),
            eq(programs.status, 'active')
          )
        )
        .groupBy(programs.coachId),
    ]);

    const coachUsersMap = new Map(coachUsers.map((u) => [u.id, u]));
    const coachProfilesMap = new Map(coachProfilesData.map((p) => [p.userId, p]));
    const programsMap = new Map(programCounts.map((p) => [p.coachId, p.count]));

    const formattedCoaches = coachRows.map((row) => {
      const coach = coachUsersMap.get(row.coachId);
      const profile = coachProfilesMap.get(row.coachId);

      return {
        // Flat fields (mobile-friendly)
        coachId: row.coachId,
        name: coach?.name ?? null,
        avatarUrl: coach?.avatarUrl ?? null,
        headline: profile?.headline ?? null,
        specialties: (profile?.specialties as string[] | null) ?? null,
        slug: profile?.slug ?? null,
        lastBookingDate: row.lastBookingDate,
        totalSessions: row.totalSessions,
        activeProgramsCount: programsMap.get(row.coachId) ?? 0,
        // Nested alias for backward compatibility with the web component
        id: row.coachId,
        email: coach?.email ?? null,
        profile: profile
          ? {
              headline: profile.headline,
              slug: profile.slug,
              specialties: profile.specialties as string[] | null,
            }
          : null,
      };
    });

    return Response.json({
      success: true,
      data: {
        coaches: formattedCoaches,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('[my-coaches] Error fetching coaches:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch coaches' } },
      { status: 500 }
    );
  }
}
