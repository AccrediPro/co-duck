/**
 * @fileoverview Account Deletion API
 *
 * Initiates account deletion: cancels future bookings, then deletes user via Clerk
 * (which triggers cascade delete via Clerk webhook → DB cascade).
 *
 * @module api/settings/delete-account
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, users } from '@/db/schema';
import { eq, or, and, gte } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { createNotification } from '@/lib/notifications';
import { z } from 'zod';

const deleteSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT'),
});

/**
 * POST /api/settings/delete-account
 *
 * Initiate account deletion. Requires confirmation text.
 * Cancels all future bookings, then deletes the Clerk user
 * (which cascades to DB via the Clerk webhook).
 *
 * @body {string} confirmation - Must be exactly "DELETE MY ACCOUNT"
 *
 * @returns Success message
 */
export async function POST(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'delete-account');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message: 'Please confirm by sending { "confirmation": "DELETE MY ACCOUNT" }',
          },
        },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Cancel all future bookings (as coach or client)
    const now = new Date();
    const futureBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          or(eq(bookings.coachId, userId), eq(bookings.clientId, userId)),
          gte(bookings.startTime, now)
        )
      );

    const activeFutureBookings = futureBookings.filter(
      (b) => b.status === 'pending' || b.status === 'confirmed'
    );

    for (const booking of activeFutureBookings) {
      await db
        .update(bookings)
        .set({
          status: 'cancelled',
          cancelledBy: userId,
          cancelledAt: now,
          cancellationReason: 'Account deleted',
        })
        .where(eq(bookings.id, booking.id));

      // Notify the other party
      const otherPartyId = booking.coachId === userId ? booking.clientId : booking.coachId;
      createNotification({
        userId: otherPartyId,
        type: 'booking_cancelled',
        title: 'Session cancelled',
        body: 'A session was cancelled because the other party deleted their account.',
        link:
          booking.coachId === userId
            ? `/dashboard/my-sessions/${booking.id}`
            : `/dashboard/sessions/${booking.id}`,
      });
    }

    // Delete user from Clerk (this will trigger the Clerk webhook user.deleted event,
    // which handles the DB cascade deletion)
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);

    return Response.json({
      success: true,
      data: {
        message: 'Account deletion initiated. Your data will be removed shortly.',
        cancelledBookings: activeFutureBookings.length,
      },
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete account' } },
      { status: 500 }
    );
  }
}
