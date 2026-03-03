/**
 * @fileoverview Conversations API
 *
 * List and create conversations for the authenticated user.
 *
 * @module api/conversations
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { conversations, messages, users } from '@/db/schema';
import { eq, or, desc, and, ne, sql, inArray } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/conversations
 *
 * Returns the authenticated user's conversations.
 *
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page
 *
 * @returns {Object} Paginated conversation list with last message and unread count
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'conversations-list');
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
    const offset = (page - 1) * limit;

    // Get total count and paginated conversations in parallel
    const whereClause = or(eq(conversations.coachId, userId), eq(conversations.clientId, userId));
    const [countResult, paginatedConversations] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(whereClause),
      db
        .select()
        .from(conversations)
        .where(whereClause)
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;

    if (paginatedConversations.length === 0) {
      return Response.json({
        success: true,
        data: {
          conversations: [],
          pagination: { page, limit, total, totalPages: 0 },
        },
      });
    }

    // Get other user info for each conversation
    const otherUserIds = paginatedConversations.map((c) =>
      c.coachId === userId ? c.clientId : c.coachId
    );
    const usersData = await db.select().from(users).where(inArray(users.id, otherUserIds));
    const usersMap = new Map(usersData.map((u) => [u.id, u]));

    // Get last message and unread count for each conversation
    const conversationIds = paginatedConversations.map((c) => c.id);

    // Get last messages
    const lastMessages = await db
      .select()
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(desc(messages.createdAt));

    // Group last messages by conversation
    const lastMessageMap = new Map<number, typeof messages.$inferSelect>();
    for (const msg of lastMessages) {
      if (!lastMessageMap.has(msg.conversationId)) {
        lastMessageMap.set(msg.conversationId, msg);
      }
    }

    // Get unread counts (messages not sent by user and not read)
    const unreadMessages = await db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(
        and(
          inArray(messages.conversationId, conversationIds),
          ne(messages.senderId, userId),
          eq(messages.isRead, false)
        )
      )
      .groupBy(messages.conversationId);

    const unreadMap = new Map(unreadMessages.map((u) => [u.conversationId, u.count]));

    // Format response
    const formattedConversations = paginatedConversations.map((conv) => {
      const otherUserId = conv.coachId === userId ? conv.clientId : conv.coachId;
      const otherUser = usersMap.get(otherUserId);
      const lastMessage = lastMessageMap.get(conv.id);
      const unreadCount = unreadMap.get(conv.id) || 0;

      return {
        id: conv.id,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        otherUser: otherUser
          ? {
              id: otherUser.id,
              name: otherUser.name,
              avatarUrl: otherUser.avatarUrl,
            }
          : null,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              messageType: lastMessage.messageType,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount,
        isCoach: conv.coachId === userId,
      };
    });

    return Response.json({
      success: true,
      data: {
        conversations: formattedConversations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch conversations' },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 *
 * Creates or gets a conversation with another user.
 *
 * @body {string} otherUserId - The other user's ID
 *
 * @returns {Object} Conversation data
 */
export async function POST(request: Request) {
  const rlp = rateLimit(request, WRITE_LIMIT, 'conversations-create');
  if (!rlp.success) return rateLimitResponse(rlp);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { otherUserId } = body;

    if (!otherUserId) {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'otherUserId is required' } },
        { status: 400 }
      );
    }

    if (otherUserId === userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_USER', message: 'Cannot create conversation with yourself' },
        },
        { status: 400 }
      );
    }

    // Get both users to determine roles
    const [currentUser, otherUser] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, userId) }),
      db.query.users.findFirst({ where: eq(users.id, otherUserId) }),
    ]);

    if (!otherUser) {
      return Response.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Determine coach and client based on roles
    let coachId: string;
    let clientId: string;

    if (currentUser?.role === 'coach' && otherUser.role === 'client') {
      coachId = userId;
      clientId = otherUserId;
    } else if (currentUser?.role === 'client' && otherUser.role === 'coach') {
      coachId = otherUserId;
      clientId = userId;
    } else {
      // If both are same role, use alphabetical order for consistency
      [coachId, clientId] = [userId, otherUserId].sort();
    }

    // Check for existing conversation
    const existingConversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.coachId, coachId), eq(conversations.clientId, clientId)),
    });

    if (existingConversation) {
      return Response.json({
        success: true,
        data: {
          id: existingConversation.id,
          coachId: existingConversation.coachId,
          clientId: existingConversation.clientId,
          lastMessageAt: existingConversation.lastMessageAt,
          createdAt: existingConversation.createdAt,
          isNew: false,
        },
      });
    }

    // Create new conversation
    const [newConversation] = await db
      .insert(conversations)
      .values({
        coachId,
        clientId,
      })
      .returning();

    return Response.json({
      success: true,
      data: {
        id: newConversation.id,
        coachId: newConversation.coachId,
        clientId: newConversation.clientId,
        lastMessageAt: newConversation.lastMessageAt,
        createdAt: newConversation.createdAt,
        isNew: true,
      },
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create conversation' },
      },
      { status: 500 }
    );
  }
}
