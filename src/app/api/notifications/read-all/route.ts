/**
 * @fileoverview Mark All Notifications Read API
 *
 * @module api/notifications/read-all
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/notifications/read-all
 *
 * Marks all unread notifications as read for the current user.
 *
 * @returns {Object} Count of notifications marked as read
 */
export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });

    return Response.json({
      success: true,
      data: {
        markedRead: result.length,
      },
    });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notifications read' },
      },
      { status: 500 }
    );
  }
}
