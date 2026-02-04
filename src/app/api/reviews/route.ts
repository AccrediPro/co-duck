/**
 * @fileoverview Reviews API
 *
 * Create reviews for completed coaching sessions.
 *
 * @module api/reviews
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, reviews, coachProfiles } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * POST /api/reviews
 *
 * Creates a new review for a completed booking.
 *
 * @body {number} bookingId - ID of the completed booking
 * @body {number} rating - Star rating (1-5)
 * @body {string} [title] - Optional review title
 * @body {string} [content] - Optional review content
 * @body {boolean} [isPublic=true] - Whether review is publicly visible
 *
 * @returns {Object} Created review
 *
 * @example Request
 * {
 *   "bookingId": 123,
 *   "rating": 5,
 *   "title": "Amazing coaching session!",
 *   "content": "Really helped me clarify my goals...",
 *   "isPublic": true
 * }
 *
 * @example Response
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "bookingId": 123,
 *     "rating": 5,
 *     "title": "Amazing coaching session!",
 *     "content": "...",
 *     "isPublic": true,
 *     "createdAt": "2024-01-15T..."
 *   }
 * }
 */
export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { bookingId, rating, title, content, isPublic = true } = body;

    // Validate required fields
    if (!bookingId || rating === undefined || rating === null) {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'bookingId and rating are required' } },
        { status: 400 }
      );
    }

    // Validate rating is 1-5
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return Response.json(
        { success: false, error: { code: 'INVALID_RATING', message: 'Rating must be between 1 and 5' } },
        { status: 400 }
      );
    }

    // Get the booking
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      return Response.json(
        { success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Verify the user is the client for this booking
    if (booking.clientId !== userId) {
      return Response.json(
        { success: false, error: { code: 'NOT_AUTHORIZED', message: 'You can only review your own bookings' } },
        { status: 403 }
      );
    }

    // Verify booking is completed
    if (booking.status !== 'completed') {
      return Response.json(
        { success: false, error: { code: 'BOOKING_NOT_COMPLETED', message: 'You can only review completed sessions' } },
        { status: 400 }
      );
    }

    // Check for existing review
    const existingReview = await db.query.reviews.findFirst({
      where: eq(reviews.bookingId, bookingId),
    });

    if (existingReview) {
      return Response.json(
        { success: false, error: { code: 'ALREADY_REVIEWED', message: 'You have already reviewed this session' } },
        { status: 409 }
      );
    }

    // Create the review
    const [newReview] = await db
      .insert(reviews)
      .values({
        bookingId,
        coachId: booking.coachId,
        clientId: userId,
        rating: ratingNum,
        title: title || null,
        content: content || null,
        isPublic: isPublic !== false, // default to true
      })
      .returning();

    // Update coach's average rating and review count
    // Calculate new average from all reviews
    const statsResult = await db
      .select({
        avgRating: sql<string>`ROUND(AVG(${reviews.rating})::numeric, 2)::text`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .where(eq(reviews.coachId, booking.coachId));

    const stats = statsResult[0];

    // Update coach profile with new stats
    await db
      .update(coachProfiles)
      .set({
        averageRating: stats.avgRating,
        reviewCount: stats.totalCount,
      })
      .where(eq(coachProfiles.userId, booking.coachId));

    return Response.json({
      success: true,
      data: {
        id: newReview.id,
        bookingId: newReview.bookingId,
        rating: newReview.rating,
        title: newReview.title,
        content: newReview.content,
        isPublic: newReview.isPublic,
        createdAt: newReview.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create review' } },
      { status: 500 }
    );
  }
}
