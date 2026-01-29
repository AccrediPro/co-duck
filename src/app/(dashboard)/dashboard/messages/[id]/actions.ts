'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or, desc, lt, ne, gt, asc } from 'drizzle-orm';
import { db, conversations, messages, users } from '@/db';

// Message with sender info
export interface MessageWithSender {
  id: number;
  content: string;
  messageType: 'text' | 'system';
  senderId: string;
  senderName: string | null;
  senderAvatar: string | null;
  isOwn: boolean;
  isRead: boolean;
  createdAt: Date;
}

// Conversation details for the header
export interface ConversationDetails {
  id: number;
  otherUserId: string;
  otherUserName: string | null;
  otherUserAvatar: string | null;
  isCoach: boolean;
}

export interface GetConversationDetailsResult {
  success: boolean;
  conversation?: ConversationDetails;
  error?: string;
}

export async function getConversationDetails(
  conversationId: number
): Promise<GetConversationDetailsResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Get conversation and verify user is a participant
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
        )
      )
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found' };
    }

    const conversation = conversationRecords[0];
    const isCoach = conversation.coachId === userId;
    const otherUserId = isCoach ? conversation.clientId : conversation.coachId;

    // Get other user's info
    const otherUserRecords = await db
      .select({
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, otherUserId))
      .limit(1);

    const otherUser = otherUserRecords[0];

    return {
      success: true,
      conversation: {
        id: conversation.id,
        otherUserId,
        otherUserName: otherUser?.name || null,
        otherUserAvatar: otherUser?.avatarUrl || null,
        isCoach,
      },
    };
  } catch (error) {
    console.error('Error fetching conversation details:', error);
    return { success: false, error: 'Failed to fetch conversation details' };
  }
}

export interface GetMessagesResult {
  success: boolean;
  messages?: MessageWithSender[];
  hasMore?: boolean;
  error?: string;
}

export async function getMessages(
  conversationId: number,
  limit: number = 50,
  beforeId?: number
): Promise<GetMessagesResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify user is a participant
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
        )
      )
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found' };
    }

    // Build query conditions
    const conditions = [eq(messages.conversationId, conversationId)];

    if (beforeId) {
      conditions.push(lt(messages.id, beforeId));
    }

    // Fetch messages (newest first for pagination, but we'll reverse for display)
    const messagesData = await db
      .select({
        id: messages.id,
        content: messages.content,
        messageType: messages.messageType,
        senderId: messages.senderId,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1); // Fetch one extra to check if there are more

    const hasMore = messagesData.length > limit;
    const messagesToReturn = hasMore ? messagesData.slice(0, limit) : messagesData;

    // Get sender info for each message
    const senderIds = Array.from(new Set(messagesToReturn.map((m) => m.senderId)));
    const senderRecords = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        senderIds.length > 0
          ? or(...senderIds.map((id) => eq(users.id, id)))
          : eq(users.id, 'nonexistent')
      );

    const senderMap = new Map(senderRecords.map((s) => [s.id, s]));

    // Map messages with sender info
    const messagesWithSender: MessageWithSender[] = messagesToReturn.map((msg) => {
      const sender = senderMap.get(msg.senderId);
      return {
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        senderId: msg.senderId,
        senderName: sender?.name || null,
        senderAvatar: sender?.avatarUrl || null,
        isOwn: msg.senderId === userId,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
      };
    });

    // Reverse to get oldest first for display
    messagesWithSender.reverse();

    return {
      success: true,
      messages: messagesWithSender,
      hasMore,
    };
  } catch (error) {
    console.error('Error fetching messages:', error);
    return { success: false, error: 'Failed to fetch messages' };
  }
}

export interface MarkMessagesAsReadResult {
  success: boolean;
  error?: string;
}

export async function markMessagesAsRead(
  conversationId: number
): Promise<MarkMessagesAsReadResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify user is a participant
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
        )
      )
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found' };
    }

    // Mark all messages from the other user as read
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          ne(messages.senderId, userId),
          eq(messages.isRead, false)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return { success: false, error: 'Failed to mark messages as read' };
  }
}

// Send message result
export interface SendMessageResult {
  success: boolean;
  message?: MessageWithSender;
  error?: string;
}

/**
 * Send a message in a conversation
 * - Validates user is a participant
 * - Creates message record
 * - Updates conversation.last_message_at
 * - Returns the new message
 */
export async function sendMessage(
  conversationId: number,
  content: string
): Promise<SendMessageResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  // Validate content - don't send empty/whitespace-only messages
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return { success: false, error: 'Message cannot be empty' };
  }

  try {
    // Verify user is a participant
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
        )
      )
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found' };
    }

    // Get sender's info for the response
    const senderRecords = await db
      .select({
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const sender = senderRecords[0];

    const now = new Date();

    // Create the message
    const newMessageRecords = await db
      .insert(messages)
      .values({
        conversationId,
        senderId: userId,
        content: trimmedContent,
        messageType: 'text',
        isRead: false,
      })
      .returning();

    const newMessage = newMessageRecords[0];

    // Update conversation's last_message_at
    await db
      .update(conversations)
      .set({ lastMessageAt: now })
      .where(eq(conversations.id, conversationId));

    // Return the message with sender info
    return {
      success: true,
      message: {
        id: newMessage.id,
        content: newMessage.content,
        messageType: newMessage.messageType,
        senderId: newMessage.senderId,
        senderName: sender?.name || null,
        senderAvatar: sender?.avatarUrl || null,
        isOwn: true,
        isRead: newMessage.isRead,
        createdAt: newMessage.createdAt,
      },
    };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: 'Failed to send message' };
  }
}

// Get new messages result
export interface GetNewMessagesResult {
  success: boolean;
  messages?: MessageWithSender[];
  error?: string;
}

/**
 * Get messages newer than the provided message ID (for polling)
 * Returns messages in chronological order (oldest to newest)
 */
export async function getNewMessages(
  conversationId: number,
  afterId: number
): Promise<GetNewMessagesResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify user is a participant
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
        )
      )
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found' };
    }

    // Fetch messages newer than afterId, ordered by creation time ascending
    const newMessagesData = await db
      .select({
        id: messages.id,
        content: messages.content,
        messageType: messages.messageType,
        senderId: messages.senderId,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), gt(messages.id, afterId)))
      .orderBy(asc(messages.createdAt));

    if (newMessagesData.length === 0) {
      return { success: true, messages: [] };
    }

    // Get sender info for each message
    const senderIds = Array.from(new Set(newMessagesData.map((m) => m.senderId)));
    const senderRecords = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        senderIds.length > 0
          ? or(...senderIds.map((id) => eq(users.id, id)))
          : eq(users.id, 'nonexistent')
      );

    const senderMap = new Map(senderRecords.map((s) => [s.id, s]));

    // Map messages with sender info
    const messagesWithSender: MessageWithSender[] = newMessagesData.map((msg) => {
      const msgSender = senderMap.get(msg.senderId);
      return {
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        senderId: msg.senderId,
        senderName: msgSender?.name || null,
        senderAvatar: msgSender?.avatarUrl || null,
        isOwn: msg.senderId === userId,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
      };
    });

    return {
      success: true,
      messages: messagesWithSender,
    };
  } catch (error) {
    console.error('Error fetching new messages:', error);
    return { success: false, error: 'Failed to fetch new messages' };
  }
}
