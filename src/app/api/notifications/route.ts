/**
 * @fileoverview Notifications API
 *
 * List notifications for the authenticated user.
 *
 * @module api/notifications
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc, lt, sql } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/notifications
 *
 * Returns notifications for the current user (paginated, newest first).
 *
 * @query {number} [limit=30] - Notifications to fetch (max 100)
 * @query {string} [before] - Cursor for pagination (notification ID)
 * @query {string} [unread] - If "true", only return unread notifications
 *
 * @returns {Object} Paginated notifications with unread count
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'notifications-list');
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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')));
    const before = searchParams.get('before');
    const unreadOnly = searchParams.get('unread') === 'true';

    // Build conditions
    const conditions = [eq(notifications.userId, userId)];

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    if (before) {
      const beforeId = parseInt(before);
      if (!isNaN(beforeId)) {
        conditions.push(lt(notifications.id, beforeId));
      }
    }

    // Fetch notifications + unread count in parallel
    const [notificationList, unreadResult] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit + 1),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
    ]);

    const hasMore = notificationList.length > limit;
    const paginated = hasMore ? notificationList.slice(0, -1) : notificationList;
    const unreadCount = unreadResult[0]?.count ?? 0;

    return Response.json({
      success: true,
      data: {
        notifications: paginated.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          isRead: n.isRead,
          createdAt: n.createdAt,
        })),
        unreadCount,
        hasMore,
        nextCursor: hasMore ? paginated[paginated.length - 1]?.id.toString() : null,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 *
 * Mark a specific notification as read.
 *
 * @body {number} id - Notification ID to mark as read
 *
 * @returns {Object} Updated notification
 */
export async function PATCH(request: Request) {
  const rlp = rateLimit(request, WRITE_LIMIT, 'notifications-patch');
  if (!rlp.success) return rateLimitResponse(rlp);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const notificationId = parseInt(body.id);

    if (isNaN(notificationId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid notification ID' } },
        { status: 400 }
      );
    }

    // Mark as read (only if it belongs to the user)
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
        id: updated.id,
        isRead: updated.isRead,
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
