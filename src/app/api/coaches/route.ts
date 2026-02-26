/**
 * @fileoverview List Coaches API
 *
 * Returns paginated list of published coaches.
 * Supports SQL-level filtering by specialty, search, rating, price, and sorting.
 *
 * @module api/coaches
 */

import { db } from '@/db';
import { users, coachProfiles } from '@/db/schema';
import { eq, and, gte, lte, ilike, or, sql, desc, asc } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/coaches
 *
 * Returns paginated list of published coaches with SQL-level filtering.
 *
 * @query {string} [search] - Search by name, headline, or bio (ILIKE)
 * @query {string} [specialty] - Filter by specialty (JSONB contains)
 * @query {number} [minRating] - Minimum average rating (e.g., 4)
 * @query {number} [minPrice] - Minimum hourly rate in cents
 * @query {number} [maxPrice] - Maximum hourly rate in cents
 * @query {string} [sort] - Sort by: rating, price_asc, price_desc, reviews, newest (default: rating)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page (max 50)
 *
 * @returns {Object} Paginated coach list
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'coaches-list');
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || '';
    const specialty = searchParams.get('specialty') || '';
    const minRating = searchParams.get('minRating');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const sort = searchParams.get('sort') || 'rating';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build SQL conditions
    const conditions = [eq(coachProfiles.isPublished, true)];

    // Search: name, headline, or bio (SQL ILIKE)
    if (search) {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(coachProfiles.headline, `%${search}%`),
          ilike(coachProfiles.bio, `%${search}%`)
        )!
      );
    }

    // Specialty filter: JSONB array contains (SQL level)
    if (specialty) {
      conditions.push(
        sql`${coachProfiles.specialties}::jsonb @> ${JSON.stringify([specialty])}::jsonb`
      );
    }

    // Rating filter
    if (minRating) {
      const rating = parseFloat(minRating);
      if (!isNaN(rating)) {
        conditions.push(gte(sql`${coachProfiles.averageRating}::numeric`, rating));
      }
    }

    // Price range filter (hourly rate in cents)
    if (minPrice) {
      const min = parseInt(minPrice);
      if (!isNaN(min)) {
        conditions.push(gte(coachProfiles.hourlyRate, min));
      }
    }
    if (maxPrice) {
      const max = parseInt(maxPrice);
      if (!isNaN(max)) {
        conditions.push(lte(coachProfiles.hourlyRate, max));
      }
    }

    // Sort order
    let orderBy;
    switch (sort) {
      case 'price_asc':
        orderBy = asc(coachProfiles.hourlyRate);
        break;
      case 'price_desc':
        orderBy = desc(coachProfiles.hourlyRate);
        break;
      case 'reviews':
        orderBy = desc(coachProfiles.reviewCount);
        break;
      case 'newest':
        orderBy = desc(coachProfiles.createdAt);
        break;
      case 'rating':
      default:
        orderBy = desc(sql`${coachProfiles.averageRating}::numeric`);
        break;
    }

    const whereClause = and(...conditions);

    // Run count + data queries in parallel
    const [coaches, countResult] = await Promise.all([
      db
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
          averageRating: coachProfiles.averageRating,
          reviewCount: coachProfiles.reviewCount,
          verificationStatus: coachProfiles.verificationStatus,
          userName: users.name,
          userEmail: users.email,
          userAvatar: users.avatarUrl,
        })
        .from(coachProfiles)
        .innerJoin(users, eq(users.id, coachProfiles.userId))
        .where(whereClause)
        .orderBy(orderBy)
        .offset(offset)
        .limit(limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(coachProfiles)
        .innerJoin(users, eq(users.id, coachProfiles.userId))
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    // Format response
    const formattedCoaches = coaches.map((coach) => ({
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
      averageRating: coach.averageRating,
      reviewCount: coach.reviewCount,
      isVerified: coach.verificationStatus === 'verified',
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
