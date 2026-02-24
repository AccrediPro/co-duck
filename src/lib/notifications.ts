/**
 * @fileoverview Notification Helper
 *
 * Creates in-app notifications for platform events.
 * Used by API routes to notify users of bookings, messages, reviews, etc.
 *
 * @module lib/notifications
 */

import { db } from '@/db';
import { notifications } from '@/db/schema';
import type { NewNotification } from '@/db/schema';

type NotificationType = NewNotification['type'];

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Creates an in-app notification for a user.
 * Non-blocking — errors are logged but don't throw.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body || null,
      link: params.link || null,
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

/**
 * Creates notifications for multiple users with the same content.
 */
export async function createNotifications(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await db.insert(notifications).values(
      userIds.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        body: params.body || null,
        link: params.link || null,
      }))
    );
  } catch (error) {
    console.error('Failed to create notifications:', error);
  }
}
