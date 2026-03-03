/**
 * @fileoverview Notification Details API
 *
 * Mark a specific notification as read.
 *
 * @module api/notifications/[id]
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  isRead: z.literal(true),
});

/**
 * PATCH /api/notifications/:id
 *
 * Marks a specific notification as read.
 * The notification must belong to the authenticated user.
 *
 * @param {string} id - Notification ID
 * @body {true} isRead - Must be true
 *
 * @returns Updated notification
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'notifications-patch');
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
    const notificationId = parseInt(id);

    if (isNaN(notificationId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid notification ID' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_BODY', message: 'isRead must be true' },
        },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();

    if (!updated) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: {
        notification: {
          id: updated.id,
          type: updated.type,
          title: updated.title,
          body: updated.body,
          link: updated.link,
          isRead: updated.isRead,
          createdAt: updated.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update notification' },
      },
      { status: 500 }
    );
  }
}
