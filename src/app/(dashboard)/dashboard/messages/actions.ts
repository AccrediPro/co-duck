/**
 * @fileoverview Server actions for the conversations list page.
 *
 * This module provides functionality for displaying the user's conversation inbox,
 * including search, unread counts, and conversation previews.
 *
 * ## Features
 *
 * - List all conversations for the authenticated user
 * - Search conversations by other user's name
 * - Track unread message counts per conversation and total
 * - Support for both coaches and clients (role-agnostic inbox)
 *
 * ## Data Flow
 *
 * 1. User navigates to `/dashboard/messages`
 * 2. Server component calls `getConversations()` to fetch list
 * 3. ConversationsList component renders with initial data
 * 4. Search queries trigger `getConversations(searchQuery)`
 *
 * ## Related Files
 *
 * - `src/lib/conversations.ts` - Core conversation management
 * - `src/app/(dashboard)/dashboard/messages/[id]/actions.ts` - Chat view actions
 * - `src/components/messages/conversations-list.tsx` - List UI component
 *
 * @module dashboard/messages/actions
 */

'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or, desc, sql, ne } from 'drizzle-orm';
import { db, conversations, messages, users } from '@/db';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Conversation with enriched details for display in the inbox list.
 *
 * @property id - Database conversation ID
 * @property otherUserId - Clerk user ID of the other participant
 * @property otherUserName - Display name of the other user (may be null)
 * @property otherUserAvatar - Avatar URL of the other user (may be null)
 * @property lastMessageContent - Preview of the most recent message
 * @property lastMessageAt - Timestamp of the most recent message
 * @property unreadCount - Number of unread messages from the other user
 * @property isCoach - Whether the current user is the coach in this conversation
 */
export interface ConversationWithDetails {
  id: number;
  otherUserId: string;
  otherUserName: string | null;
  otherUserAvatar: string | null;
  lastMessageContent: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  isCoach: boolean; // Whether the current user is the coach in this conversation
}

/**
 * Result type for getConversations server action.
 *
 * @property success - Whether the operation succeeded
 * @property conversations - Array of conversations with details (on success)
 * @property error - Error message (on failure)
 */
export interface GetConversationsResult {
  success: boolean;
  conversations?: ConversationWithDetails[];
  error?: string;
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Fetch all conversations for the authenticated user.
 *
 * Returns conversations where the user is either the coach or client,
 * enriched with other user details, last message preview, and unread count.
 *
 * @param searchQuery - Optional name filter (case-insensitive substring match)
 * @returns Result object with conversations array on success
 *
 * @example
 * // Fetch all conversations
 * const result = await getConversations();
 * if (result.success) {
 *   console.log(`${result.conversations.length} conversations`);
 * }
 *
 * @example
 * // Search by name
 * const result = await getConversations('john');
 * // Returns conversations where other user's name contains "john"
 *
 * @security Requires authentication. Only returns conversations where user is a participant.
 */
export async function getConversations(searchQuery?: string): Promise<GetConversationsResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Get user's role to determine how to query
    const userResult = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return { success: false, error: 'User not found' };
    }

    // userRole is available for future role-specific filtering if needed
    void userResult[0].role;

    // Get all conversations where user is either coach or client
    const conversationsData = await db
      .select({
        id: conversations.id,
        coachId: conversations.coachId,
        clientId: conversations.clientId,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId)))
      .orderBy(desc(conversations.lastMessageAt));

    // For each conversation, get the other user's info, last message, and unread count
    const conversationsWithDetails: ConversationWithDetails[] = await Promise.all(
      conversationsData.map(async (conv) => {
        const isCoach = conv.coachId === userId;
        const otherUserId = isCoach ? conv.clientId : conv.coachId;

        // Get other user's info
        const otherUserResult = await db
          .select({
            name: users.name,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(eq(users.id, otherUserId))
          .limit(1);

        const otherUser = otherUserResult[0];

        // Get last message content
        const lastMessageResult = await db
          .select({
            content: messages.content,
          })
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const lastMessage = lastMessageResult[0];

        // Get unread count (messages from other user that haven't been read)
        const unreadResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conv.id),
              ne(messages.senderId, userId),
              eq(messages.isRead, false)
            )
          );

        return {
          id: conv.id,
          otherUserId,
          otherUserName: otherUser?.name || null,
          otherUserAvatar: otherUser?.avatarUrl || null,
          lastMessageContent: lastMessage?.content || null,
          lastMessageAt: conv.lastMessageAt,
          unreadCount: unreadResult[0]?.count || 0,
          isCoach,
        };
      })
    );

    // Filter by search query if provided
    let filteredConversations = conversationsWithDetails;
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredConversations = conversationsWithDetails.filter((conv) =>
        conv.otherUserName?.toLowerCase().includes(query)
      );
    }

    return {
      success: true,
      conversations: filteredConversations,
    };
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return { success: false, error: 'Failed to fetch conversations' };
  }
}

// ============================================================================
// UNREAD COUNT FUNCTIONS
// ============================================================================

/**
 * Get total unread message count for the authenticated user.
 *
 * This is used to display the unread badge on the messages navigation item.
 * Counts messages from OTHER users that haven't been marked as read.
 *
 * @returns Result object with total unread count on success
 *
 * @example
 * // In a navigation component
 * const result = await getUnreadMessageCount();
 * if (result.success && result.count > 0) {
 *   return <Badge>{result.count}</Badge>;
 * }
 *
 * @security Requires authentication.
 */
export async function getUnreadMessageCount(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const count = await getUnreadMessageCountForUser(userId);
    return { success: true, count };
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return { success: false, error: 'Failed to fetch unread count' };
  }
}

/**
 * Internal function to get unread message count for a specific user.
 *
 * Unlike `getUnreadMessageCount`, this function:
 * - Does NOT perform authentication check
 * - Takes userId as a parameter instead of reading from auth
 *
 * This is used by the dashboard layout which already has the userId
 * from a previous auth check.
 *
 * @param userId - Clerk user ID to get unread count for
 * @returns Total unread message count
 *
 * @example
 * // In dashboard layout (already has userId from auth)
 * const unreadCount = await getUnreadMessageCountForUser(userId);
 * return <Sidebar unreadMessages={unreadCount} />;
 *
 * @internal Use `getUnreadMessageCount` for server actions called from client.
 */
export async function getUnreadMessageCountForUser(userId: string): Promise<number> {
  // Get all conversations where user is either coach or client
  const conversationIds = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId)));

  if (conversationIds.length === 0) {
    return 0;
  }

  // Count unread messages from other users in all conversations
  let totalUnread = 0;
  for (const conv of conversationIds) {
    const unreadResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conv.id),
          ne(messages.senderId, userId),
          eq(messages.isRead, false)
        )
      );
    totalUnread += unreadResult[0]?.count || 0;
  }

  return totalUnread;
}
