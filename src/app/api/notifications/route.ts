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
import { eq, and, desc, sql } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/notifications
 *
 * Returns paginated notifications for the authenticated user, newest first.
 *
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page (max 50)
 * @query {boolean} [unreadOnly=false] - If "true", return only unread notifications
 *
 * @returns Paginated notifications with unread count
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const offset = (page - 1) * limit;

    const listCondition = unreadOnly
      ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      : eq(notifications.userId, userId);

    const [countResult, unreadResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(listCondition),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
      db
        .select()
        .from(notifications)
        .where(listCondition)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;
    const unreadCount = unreadResult[0]?.count ?? 0;

    return Response.json({
      success: true,
      data: {
        notifications: rows.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          isRead: n.isRead,
          createdAt: n.createdAt,
        })),
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
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
 * Marks a specific notification as read (by ID in request body).
 * Kept for backward compatibility — mobile should prefer PATCH /api/notifications/:id.
 *
 * @body {number} id - Notification ID to mark as read
 *
 * @returns Updated notification (id, isRead)
 */
export async function PATCH(request: Request) {
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
    const body = await request.json();
    const notificationId = parseInt(body.id);

    if (isNaN(notificationId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid notification ID' } },
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
