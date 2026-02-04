/**
 * @fileoverview Conversation Messages API
 *
 * Get and send messages in a conversation.
 *
 * @module api/conversations/[id]/messages
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { conversations, messages, users } from '@/db/schema';
import { eq, or, and, desc, inArray, lt } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id/messages
 *
 * Returns messages in a conversation (paginated, newest first).
 *
 * @param {string} id - Conversation ID
 * @query {number} [limit=50] - Messages to fetch
 * @query {string} [before] - Cursor for pagination (message ID)
 *
 * @returns {Object} Paginated messages
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const conversationId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const before = searchParams.get('before');

    if (isNaN(conversationId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid conversation ID' } },
        { status: 400 }
      );
    }

    // Verify access to conversation
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
      ),
    });

    if (!conversation) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    // Build query conditions
    const conditions = [eq(messages.conversationId, conversationId)];

    if (before) {
      const beforeId = parseInt(before);
      if (!isNaN(beforeId)) {
        conditions.push(lt(messages.id, beforeId));
      }
    }

    // Get messages
    const messageList = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1); // Fetch one extra to check if there are more

    const hasMore = messageList.length > limit;
    const paginatedMessages = hasMore ? messageList.slice(0, -1) : messageList;

    // Get sender info
    const senderIds = Array.from(new Set(paginatedMessages.map((m) => m.senderId)));
    const sendersData = senderIds.length
      ? await db.select().from(users).where(inArray(users.id, senderIds))
      : [];
    const sendersMap = new Map(sendersData.map((u) => [u.id, u]));

    // Format response
    const formattedMessages = paginatedMessages.map((msg) => {
      const sender = sendersMap.get(msg.senderId);
      return {
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
        sender: sender
          ? {
              id: sender.id,
              name: sender.name,
              avatarUrl: sender.avatarUrl,
            }
          : null,
        isOwnMessage: msg.senderId === userId,
      };
    });

    // Reverse to get chronological order
    formattedMessages.reverse();

    return Response.json({
      success: true,
      data: {
        messages: formattedMessages,
        hasMore,
        nextCursor: hasMore ? paginatedMessages[paginatedMessages.length - 1]?.id.toString() : null,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch messages' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/:id/messages
 *
 * Sends a message in a conversation.
 *
 * @param {string} id - Conversation ID
 * @body {string} content - Message content
 *
 * @returns {Object} Created message
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const conversationId = parseInt(id);
    const body = await request.json();
    const { content } = body;

    if (isNaN(conversationId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid conversation ID' } },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return Response.json(
        { success: false, error: { code: 'INVALID_CONTENT', message: 'Message content is required' } },
        { status: 400 }
      );
    }

    // Verify access to conversation
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
      ),
    });

    if (!conversation) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    // Create message
    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId,
        senderId: userId,
        content: content.trim(),
        messageType: 'text',
        isRead: false,
      })
      .returning();

    // Update conversation's lastMessageAt
    await db
      .update(conversations)
      .set({ lastMessageAt: newMessage.createdAt })
      .where(eq(conversations.id, conversationId));

    // Get sender info
    const sender = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    return Response.json({
      success: true,
      data: {
        id: newMessage.id,
        content: newMessage.content,
        messageType: newMessage.messageType,
        isRead: newMessage.isRead,
        createdAt: newMessage.createdAt,
        sender: sender
          ? {
              id: sender.id,
              name: sender.name,
              avatarUrl: sender.avatarUrl,
            }
          : null,
        isOwnMessage: true,
      },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' } },
      { status: 500 }
    );
  }
}
