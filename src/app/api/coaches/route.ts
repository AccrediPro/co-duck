/**
 * @fileoverview List Coaches API
 *
 * Returns paginated list of published coaches.
 * Supports filtering by specialty and search.
 *
 * @module api/coaches
 */

import { db } from '@/db';
import { users, coachProfiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/coaches
 *
 * Returns paginated list of published coaches.
 *
 * @query {string} [search] - Search by name or headline
 * @query {string} [specialty] - Filter by specialty
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page (max 50)
 *
 * @returns {Object} Paginated coach list
 *
 * @example Response
 * {
 *   "success": true,
 *   "data": {
 *     "coaches": [...],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "total": 45,
 *       "totalPages": 3
 *     }
 *   }
 * }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || '';
    const specialty = searchParams.get('specialty') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(coachProfiles.isPublished, true)];

    // Get all published coaches with user info
    const allCoaches = await db
      .select({
        userId: coachProfiles.userId,
        slug: coachProfiles.slug,
        headline: coachProfiles.headline,
        bio: coachProfiles.bio,
        specialties: coachProfiles.specialties,
        sessionTypes: coachProfiles.sessionTypes,
        timezone: coachProfiles.timezone,
        hourlyRate: coachProfiles.hourlyRate,
        currency: coachProfiles.currency,
        userName: users.name,
        userEmail: users.email,
        userAvatar: users.avatarUrl,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(users.id, coachProfiles.userId))
      .where(and(...conditions));

    // Filter in memory for search and specialty (simpler than complex SQL)
    let filteredCoaches = allCoaches;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredCoaches = filteredCoaches.filter(
        (coach) =>
          coach.userName?.toLowerCase().includes(searchLower) ||
          coach.headline?.toLowerCase().includes(searchLower) ||
          coach.bio?.toLowerCase().includes(searchLower)
      );
    }

    if (specialty) {
      const specialtyLower = specialty.toLowerCase();
      filteredCoaches = filteredCoaches.filter((coach) =>
        (coach.specialties as string[])?.some((s) => s.toLowerCase().includes(specialtyLower))
      );
    }

    // Paginate
    const total = filteredCoaches.length;
    const paginatedCoaches = filteredCoaches.slice(offset, offset + limit);

    // Format response
    const formattedCoaches = paginatedCoaches.map((coach) => ({
      id: coach.userId,
      slug: coach.slug,
      name: coach.userName,
      avatarUrl: coach.userAvatar,
      headline: coach.headline,
      bio: coach.bio,
      specialties: coach.specialties,
      sessionTypes: coach.sessionTypes,
      timezone: coach.timezone,
      hourlyRate: coach.hourlyRate,
      currency: coach.currency,
    }));

    return Response.json({
      success: true,
      data: {
        coaches: formattedCoaches,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching coaches:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch coaches' } },
      { status: 500 }
    );
  }
}
