import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { iconnectPosts, conversations } from '@/db/schema';
import { eq, and, ne, or, inArray, count } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'iconnect-unread');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Get all conversations this user is part of
    const userConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId)));

    if (userConversations.length === 0) {
      return Response.json({ success: true, data: { unreadCount: 0 } });
    }

    const convoIds = userConversations.map((c) => c.id);

    // Count unread iConnect posts sent by others
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

    return Response.json({
      success: true,
      data: { unreadCount: result?.total ?? 0 },
    });
  } catch (error) {
    console.error('Error fetching iConnect unread count:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch unread count' } },
      { status: 500 }
    );
  }
}
