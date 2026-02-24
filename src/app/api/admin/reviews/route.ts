/**
 * @fileoverview Admin Reviews List API
 *
 * List all reviews for moderation (admin only).
 *
 * @module api/admin/reviews
 */

import { db } from '@/db';
import { reviews, users } from '@/db/schema';
import { desc, inArray, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * GET /api/admin/reviews
 *
 * List all reviews with coach/client info for moderation.
 *
 * @query {number} [page=1]
 * @query {number} [limit=30]
 *
 * @returns Paginated reviews with user info
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')));
    const offset = (page - 1) * limit;

    const [allReviews, countResult] = await Promise.all([
      db.select().from(reviews).orderBy(desc(reviews.createdAt)).offset(offset).limit(limit),
      db.select({ count: sql<number>`count(*)::int` }).from(reviews),
    ]);

    // Get user names
    const userIds = Array.from(new Set(allReviews.flatMap((r) => [r.coachId, r.clientId])));
    const usersData = userIds.length
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const usersMap = new Map(usersData.map((u) => [u.id, u]));

    const total = countResult[0]?.count ?? 0;

    return Response.json({
      success: true,
      data: {
        reviews: allReviews.map((r) => ({
          id: r.id,
          bookingId: r.bookingId,
          rating: r.rating,
          title: r.title,
          content: r.content,
          coachResponse: r.coachResponse,
          isPublic: r.isPublic,
          createdAt: r.createdAt,
          coach: usersMap.get(r.coachId)
            ? { id: r.coachId, name: usersMap.get(r.coachId)!.name }
            : null,
          client: usersMap.get(r.clientId)
            ? { id: r.clientId, name: usersMap.get(r.clientId)!.name }
            : null,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Error fetching admin reviews:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reviews' } },
      { status: 500 }
    );
  }
}
