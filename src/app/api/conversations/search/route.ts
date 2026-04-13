import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { conversations, messages, users } from '@/db/schema';
import { eq, or, and, sql, desc, ilike } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface MessageSearchResult {
  conversationId: number;
  messageId: number;
  content: string;
  senderId: string;
  senderName: string | null;
  createdAt: Date;
  otherUser: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'conversations-search');
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
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    if (!query || query.length < 2) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_QUERY', message: 'Search query must be at least 2 characters' },
        },
        { status: 400 }
      );
    }

    // Get user's conversation IDs first
    const userConversations = await db
      .select({
        id: conversations.id,
        coachId: conversations.coachId,
        clientId: conversations.clientId,
      })
      .from(conversations)
      .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId)));

    if (userConversations.length === 0) {
      return Response.json({
        success: true,
        data: { results: [], total: 0 },
      });
    }

    const conversationIds = userConversations.map((c) => c.id);
    const conversationMap = new Map(userConversations.map((c) => [c.id, c]));

    // Search messages with ILIKE
    const searchPattern = `%${query}%`;
    const matchingMessages = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          sql`${messages.conversationId} = ANY(${conversationIds})`,
          ilike(messages.content, searchPattern)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    if (matchingMessages.length === 0) {
      return Response.json({
        success: true,
        data: { results: [], total: 0 },
      });
    }

    // Gather unique user IDs we need to look up
    const userIdsToFetch = new Set<string>();
    for (const msg of matchingMessages) {
      userIdsToFetch.add(msg.senderId);
      const conv = conversationMap.get(msg.conversationId);
      if (conv) {
        const otherUserId = conv.coachId === userId ? conv.clientId : conv.coachId;
        userIdsToFetch.add(otherUserId);
      }
    }

    // Fetch all needed users in one query
    const usersData = await db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(sql`${users.id} = ANY(${Array.from(userIdsToFetch)})`);

    const usersMap = new Map(usersData.map((u) => [u.id, u]));

    // Build results
    const results: MessageSearchResult[] = matchingMessages.map((msg) => {
      const conv = conversationMap.get(msg.conversationId);
      const otherUserId = conv ? (conv.coachId === userId ? conv.clientId : conv.coachId) : '';
      const otherUser = usersMap.get(otherUserId);
      const sender = usersMap.get(msg.senderId);

      return {
        conversationId: msg.conversationId,
        messageId: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        senderName: sender?.name ?? null,
        createdAt: msg.createdAt,
        otherUser: {
          id: otherUserId,
          name: otherUser?.name ?? null,
          avatarUrl: otherUser?.avatarUrl ?? null,
        },
      };
    });

    return Response.json({
      success: true,
      data: { results, total: results.length },
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to search messages' },
      },
      { status: 500 }
    );
  }
}
