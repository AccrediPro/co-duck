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
import { emitNotification } from '@/lib/socket-server';
import { sendPushNotification, sendPushNotifications } from '@/lib/push-notifications';

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
 * Also emits the notification via Socket.io for real-time delivery.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const message = params.body || params.title;
    const [inserted] = await db
      .insert(notifications)
      .values({
        userId: params.userId,
        type: params.type,
        title: params.title,
        message,
        body: params.body || null,
        link: params.link || null,
      })
      .returning();

    emitNotification(params.userId, {
      id: inserted.id,
      type: inserted.type,
      title: inserted.title,
      body: inserted.body,
      link: inserted.link,
      isRead: inserted.isRead,
      createdAt: inserted.createdAt,
    });

    sendPushNotification(params.userId, {
      title: params.title,
      body: params.body || params.title,
      data: {
        type: params.type,
        ...(params.link ? { link: params.link } : {}),
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

/**
 * Creates notifications for multiple users with the same content.
 * Also emits each notification via Socket.io for real-time delivery.
 */
export async function createNotifications(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const message = params.body || params.title;
    const inserted = await db
      .insert(notifications)
      .values(
        userIds.map((userId) => ({
          userId,
          type: params.type,
          title: params.title,
          message,
          body: params.body || null,
          link: params.link || null,
        }))
      )
      .returning();

    for (const row of inserted) {
      emitNotification(row.userId, {
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        isRead: row.isRead,
        createdAt: row.createdAt,
      });
    }

    sendPushNotifications(userIds, {
      title: params.title,
      body: params.body || params.title,
      data: {
        type: params.type,
        ...(params.link ? { link: params.link } : {}),
      },
    });
  } catch (error) {
    console.error('Failed to create notifications:', error);
  }
}
