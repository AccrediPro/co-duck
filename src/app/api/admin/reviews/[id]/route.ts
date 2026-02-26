/**
 * @fileoverview Admin Review Moderation API
 *
 * Hide/unhide reviews (admin only).
 *
 * @module api/admin/reviews/[id]
 */

import { db } from '@/db';
import { reviews } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { z } from 'zod';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const moderateSchema = z.object({
  isPublic: z.boolean(),
});

/**
 * PATCH /api/admin/reviews/:id
 *
 * Moderate a review — hide or unhide it.
 *
 * @param {string} id - Review ID
 * @body {boolean} isPublic - true to show, false to hide
 *
 * @returns Updated review
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'admin-reviews-moderate');
  if (!rl.success) return rateLimitResponse(rl);

  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const { id } = await params;
    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid review ID' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = moderateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
        },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(reviews)
      .set({ isPublic: parsed.data.isPublic })
      .where(eq(reviews.id, reviewId))
      .returning();

    if (!updated) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        rating: updated.rating,
        title: updated.title,
        isPublic: updated.isPublic,
      },
    });
  } catch (error) {
    console.error('Error moderating review:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to moderate review' } },
      { status: 500 }
    );
  }
}
