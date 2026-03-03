import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { iconnectPosts, conversations, users } from '@/db/schema';
import { eq, and, ne, or, desc, inArray, sql } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'iconnect-contacts');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Fetch all conversations where user is coach or client
    const conversationsData = await db
      .select({
        id: conversations.id,
        coachId: conversations.coachId,
        clientId: conversations.clientId,
      })
      .from(conversations)
      .where(or(eq(conversations.coachId, userId), eq(conversations.clientId, userId)));

    if (conversationsData.length === 0) {
      return Response.json({ success: true, data: { contacts: [] } });
    }

    // Batch-fetch other users info
    const otherUserIds = conversationsData.map((c) =>
      c.coachId === userId ? c.clientId : c.coachId
    );
    const uniqueOtherUserIds = Array.from(new Set(otherUserIds));

    const otherUsersData = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
      })
      .from(users)
      .where(inArray(users.id, uniqueOtherUserIds));

    const usersMap = new Map(otherUsersData.map((u) => [u.id, u]));

    const conversationIds = conversationsData.map((c) => c.id);

    // Batch-fetch latest post per conversation (ordered desc, deduplicate in JS)
    const latestPostsRaw = await db
      .select({
        conversationId: iconnectPosts.conversationId,
        content: iconnectPosts.content,
        type: iconnectPosts.type,
        createdAt: iconnectPosts.createdAt,
      })
      .from(iconnectPosts)
      .where(inArray(iconnectPosts.conversationId, conversationIds))
      .orderBy(desc(iconnectPosts.createdAt));

    const latestPostMap = new Map<
      number,
      { content: string | null; type: string; createdAt: Date }
    >();
    for (const post of latestPostsRaw) {
      if (!latestPostMap.has(post.conversationId)) {
        latestPostMap.set(post.conversationId, {
          content: post.content,
          type: post.type,
          createdAt: post.createdAt,
        });
      }
    }

    // Batch-fetch unread counts (posts from the other user that are unread)
    const unreadCounts = await db
      .select({
        conversationId: iconnectPosts.conversationId,
        count: sql<number>`count(*)`,
      })
      .from(iconnectPosts)
      .where(
        and(
          inArray(iconnectPosts.conversationId, conversationIds),
          ne(iconnectPosts.senderUserId, userId),
          eq(iconnectPosts.isRead, false)
        )
      )
      .groupBy(iconnectPosts.conversationId);

    const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, Number(u.count)]));

    // Assemble contacts
    const contacts = conversationsData.map((conv) => {
      const otherUserId = conv.coachId === userId ? conv.clientId : conv.coachId;
      const otherUser = usersMap.get(otherUserId);
      const latestPost = latestPostMap.get(conv.id);
      const unreadCount = unreadMap.get(conv.id) || 0;

      let lastPostContent: string | null = null;
      if (latestPost) {
        if (latestPost.type === 'task') {
          lastPostContent = latestPost.content || 'New task';
        } else if (latestPost.type === 'image') {
          lastPostContent = latestPost.content || 'Shared an image';
        } else {
          lastPostContent = latestPost.content;
        }
      }

      return {
        conversationId: conv.id,
        otherUserId,
        otherUserName: otherUser?.name || null,
        otherUserAvatar: otherUser?.avatarUrl || null,
        otherUserRole: otherUser?.role || 'client',
        lastPostContent,
        lastPostType: latestPost?.type || null,
        lastPostAt: latestPost?.createdAt || null,
        unreadCount,
      };
    });

    // Sort: conversations with posts first (by recency), then those without
    contacts.sort((a, b) => {
      if (a.lastPostAt && b.lastPostAt) {
        return new Date(b.lastPostAt).getTime() - new Date(a.lastPostAt).getTime();
      }
      if (a.lastPostAt && !b.lastPostAt) return -1;
      if (!a.lastPostAt && b.lastPostAt) return 1;
      return 0;
    });

    return Response.json({ success: true, data: { contacts } });
  } catch (error) {
    console.error('Error fetching iConnect contacts:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch contacts' } },
      { status: 500 }
    );
  }
}
