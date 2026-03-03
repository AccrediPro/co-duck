'use server';

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { iconnectPosts, conversations } from '@/db/schema';
import { eq, and, ne, or, inArray, count } from 'drizzle-orm';

/**
 * Server action: Get total unread iConnect post count for the current user.
 * Called by the useIConnectUnread hook for real-time reconciliation.
 */
export async function getIConnectUnreadCount(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const total = await getIConnectUnreadCountForUser(userId);
    return { success: true, count: total };
  } catch (error) {
    console.error('Error fetching iConnect unread count:', error);
    return { success: false, error: 'Failed to fetch unread count' };
  }
}

/**
 * Internal function to get iConnect unread count for a specific user.
 * Does NOT perform auth check — expects caller to have already authenticated.
 * Used by the dashboard layout which already has userId from a previous auth check.
 */
export async function getIConnectUnreadCountForUser(userId: string): Promise<number> {
  const userConversations = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId)));

  if (userConversations.length === 0) {
    return 0;
  }

  const convoIds = userConversations.map((c) => c.id);

  const [result] = await db
    .select({ total: count() })
    .from(iconnectPosts)
    .where(
      and(
        inArray(iconnectPosts.conversationId, convoIds),
        ne(iconnectPosts.senderUserId, userId),
        eq(iconnectPosts.isRead, false)
      )
    );

  return result?.total ?? 0;
}
