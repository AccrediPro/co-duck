/**
 * @fileoverview Coach Review Response API
 *
 * Allows coaches to respond to client reviews on their profile.
 *
 * @module api/reviews/[id]/response
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { reviews, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const responseSchema = z.object({
  coachResponse: z.string().min(1).max(2000),
});

/**
 * PATCH /api/reviews/:id/response
 *
 * Add or update a coach's response to a review.
 * Only the coach who received the review can respond.
 *
 * @body {string} coachResponse - The coach's response text (1-2000 chars)
 *
 * @returns {Object} Updated review with coach response
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  // Rate limit: 10 requests per minute
  const rl = rateLimit(request, WRITE_LIMIT, 'reviews-response');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid review ID' } },
        { status: 400 }
      );
    }

    // Validate body
    const body = await request.json();
    const parsed = responseSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((i) => i.message).join(', '),
          },
        },
        { status: 400 }
      );
    }

    // Get the review
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
    });

    if (!review) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } },
        { status: 404 }
      );
    }

    // Only the coach can respond
    if (review.coachId !== userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the reviewed coach can respond' },
        },
        { status: 403 }
      );
    }

    // Update the review with coach response
    const [updated] = await db
      .update(reviews)
      .set({ coachResponse: parsed.data.coachResponse })
      .where(eq(reviews.id, reviewId))
      .returning();

    // Notify client that coach responded to their review
    const coachUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true },
    });

    createNotification({
      userId: review.clientId,
      type: 'review_response',
      title: 'Coach responded to your review',
      body: `${coachUser?.name || 'Your coach'} responded to your review.`,
      link: `/dashboard/my-sessions/${review.bookingId}`,
    });

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        rating: updated.rating,
        title: updated.title,
        content: updated.content,
        coachResponse: updated.coachResponse,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating review response:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update review response' },
      },
      { status: 500 }
    );
  }
}
