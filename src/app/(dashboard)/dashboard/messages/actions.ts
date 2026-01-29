'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or, desc, sql, ne } from 'drizzle-orm';
import { db, conversations, messages, users } from '@/db';

// Conversation with user info and unread count
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

export interface GetConversationsResult {
  success: boolean;
  conversations?: ConversationWithDetails[];
  error?: string;
}

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

// Get total unread message count for navigation badge
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
    // Get all conversations where user is either coach or client
    const conversationIds = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId)));

    if (conversationIds.length === 0) {
      return { success: true, count: 0 };
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

    return { success: true, count: totalUnread };
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return { success: false, error: 'Failed to fetch unread count' };
  }
}
