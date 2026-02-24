/**
 * @fileoverview Coach Reviews API
 *
 * Returns paginated public reviews for a coach by slug.
 *
 * @module api/coaches/[slug]/reviews
 */

import { db } from '@/db';
import { users, coachProfiles, reviews } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/coaches/:slug/reviews
 *
 * Returns paginated public reviews for a coach.
 *
 * @param {string} slug - Coach's URL slug (e.g., "john-smith")
 * @query {number} [page=1] - Page number
 * @query {number} [limit=10] - Items per page (max 50)
 *
 * @returns {Object} Paginated reviews with coach stats
 *
 * @example Response
 * {
 *   "success": true,
 *   "data": {
 *     "reviews": [
 *       {
 *         "id": 1,
 *         "rating": 5,
 *         "title": "Amazing coach!",
 *         "content": "...",
 *         "coachResponse": null,
 *         "createdAt": "2024-01-15T...",
 *         "client": {
 *           "name": "John D.",
 *           "avatarUrl": "https://..."
 *         }
 *       }
 *     ],
 *     "stats": {
 *       "averageRating": "4.8",
 *       "reviewCount": 15
 *     },
 *     "pagination": {
 *       "page": 1,
 *       "limit": 10,
 *       "total": 15,
 *       "totalPages": 2
 *     }
 *   }
 * }
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const offset = (page - 1) * limit;

    // Get coach profile by slug
    const coach = await db
      .select({
        userId: coachProfiles.userId,
        isPublished: coachProfiles.isPublished,
        averageRating: coachProfiles.averageRating,
        reviewCount: coachProfiles.reviewCount,
      })
      .from(coachProfiles)
      .where(eq(coachProfiles.slug, slug))
      .limit(1);

    if (coach.length === 0) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Coach not found' } },
        { status: 404 }
      );
    }

    const coachData = coach[0];

    // Check if coach is published
    if (!coachData.isPublished) {
      return Response.json(
        {
          success: false,
          error: { code: 'NOT_PUBLISHED', message: 'Coach profile is not published' },
        },
        { status: 404 }
      );
    }

    // Get total count of public reviews
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(eq(reviews.coachId, coachData.userId), eq(reviews.isPublic, true)));

    const total = countResult[0]?.count || 0;

    // Get paginated public reviews with client info
    const reviewsWithClients = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        content: reviews.content,
        coachResponse: reviews.coachResponse,
        createdAt: reviews.createdAt,
        clientId: reviews.clientId,
        clientName: users.name,
        clientAvatar: users.avatarUrl,
      })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.clientId))
      .where(and(eq(reviews.coachId, coachData.userId), eq(reviews.isPublic, true)))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);

    // Format response - anonymize client names to first name + last initial
    const formattedReviews = reviewsWithClients.map((review) => {
      // Anonymize client name: "John Smith" -> "John S."
      let anonymizedName = 'Anonymous';
      if (review.clientName) {
        const nameParts = review.clientName.split(' ');
        if (nameParts.length >= 2) {
          anonymizedName = `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`;
        } else {
          anonymizedName = nameParts[0];
        }
      }

      return {
        id: review.id,
        rating: review.rating,
        title: review.title,
        content: review.content,
        coachResponse: review.coachResponse,
        createdAt: review.createdAt,
        client: {
          name: anonymizedName,
          avatarUrl: review.clientAvatar,
        },
      };
    });

    return Response.json({
      success: true,
      data: {
        reviews: formattedReviews,
        stats: {
          averageRating: coachData.averageRating,
          reviewCount: coachData.reviewCount,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching coach reviews:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reviews' } },
      { status: 500 }
    );
  }
}
