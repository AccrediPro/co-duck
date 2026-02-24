/**
 * @fileoverview Mark Messages as Read API
 *
 * Marks all messages in a conversation as read.
 *
 * @module api/conversations/[id]/read
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { conversations, messages } from '@/db/schema';
import { eq, or, and, ne } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/conversations/:id/read
 *
 * Marks all unread messages in a conversation as read.
 * Only marks messages from the other user (not own messages).
 *
 * @param {string} id - Conversation ID
 *
 * @returns {Object} Number of messages marked as read
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

    // Mark all unread messages from other user as read
    const result = await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          ne(messages.senderId, userId),
          eq(messages.isRead, false)
        )
      )
      .returning({ id: messages.id });

    return Response.json({
      success: true,
      data: {
        markedAsRead: result.length,
      },
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to mark messages as read' },
      },
      { status: 500 }
    );
  }
}
