import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { iconnectPosts, iconnectTaskItems, conversations, users } from '@/db/schema';
import { eq, and, ne, lt, desc, inArray, count } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit, WRITE_LIMIT, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { getSocketServer } from '@/lib/socket-server';

const createPostSchema = z
  .object({
    conversationId: z.number().int().positive(),
    type: z.enum(['text', 'image', 'task']),
    content: z.string().min(1).max(5000).optional(),
    imageUrl: z.string().url().optional(),
    taskItems: z
      .array(z.object({ label: z.string().min(1).max(500) }))
      .min(1)
      .optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'text') return !!data.content;
      if (data.type === 'image') return !!data.imageUrl;
      if (data.type === 'task') return !!data.taskItems && data.taskItems.length > 0;
      return false;
    },
    {
      message:
        'text posts require content, image posts require imageUrl, task posts require taskItems',
    }
  );

async function verifyConversationMembership(conversationId: number, userId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });
  if (!conversation) return null;
  if (conversation.coachId !== userId && conversation.clientId !== userId) return null;
  return conversation;
}

/**
 * Emit Socket.io events to the OTHER user after a new iConnect post is created.
 * Fire-and-forget — errors here must never break the API response.
 */
function emitIConnectPostEvents(
  recipientUserId: string,
  postPayload: Record<string, unknown>,
  conversationId: number
): void {
  try {
    const io = getSocketServer();
    if (!io) return;

    // Emit the new post to the recipient's personal room
    io.to(`user:${recipientUserId}`).emit('iconnect:new_post', {
      conversationId,
      post: postPayload,
    });

    // Count unread iConnect posts for the recipient across ALL conversations
    // (async, fire-and-forget)
    void (async () => {
      try {
        // Get all conversations this recipient is part of
        const recipientConvos = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.coachId, recipientUserId)
            )
          );
        const recipientConvosAsClient = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.clientId, recipientUserId));

        const allConvoIds = [
          ...recipientConvos.map((c) => c.id),
          ...recipientConvosAsClient.map((c) => c.id),
        ];

        if (allConvoIds.length === 0) return;

        const [result] = await db
          .select({ total: count() })
          .from(iconnectPosts)
          .where(
            and(
              inArray(iconnectPosts.conversationId, allConvoIds),
              ne(iconnectPosts.senderUserId, recipientUserId),
              eq(iconnectPosts.isRead, false)
            )
          );

        io.to(`user:${recipientUserId}`).emit('iconnect:unread_update', {
          conversationId,
          totalUnreadCount: result?.total ?? 0,
        });
      } catch {
        // Silent — unread count emit failure is non-critical
      }
    })();
  } catch {
    // Fire-and-forget — socket emit failures must not break the caller
  }
}

export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'iconnect-posts-list');
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
    const conversationId = parseInt(searchParams.get('conversationId') || '');
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const before = parseInt(searchParams.get('before') || '');

    if (!conversationId || isNaN(conversationId)) {
      return Response.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'conversationId is required' },
        },
        { status: 400 }
      );
    }

    const conversation = await verifyConversationMembership(conversationId, userId);
    if (!conversation) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this conversation' } },
        { status: 403 }
      );
    }

    const conditions = [eq(iconnectPosts.conversationId, conversationId)];
    if (before && !isNaN(before)) {
      conditions.push(lt(iconnectPosts.id, before));
    }

    const posts = await db
      .select()
      .from(iconnectPosts)
      .where(and(...conditions))
      .orderBy(desc(iconnectPosts.createdAt))
      .limit(limit + 1);

    const hasMore = posts.length > limit;
    const paginatedPosts = posts.slice(0, limit);

    // Fetch task items for task-type posts
    const taskPostIds = paginatedPosts.filter((p) => p.type === 'task').map((p) => p.id);
    const taskItems =
      taskPostIds.length > 0
        ? await db
            .select()
            .from(iconnectTaskItems)
            .where(inArray(iconnectTaskItems.postId, taskPostIds))
        : [];
    const taskItemsByPost = new Map<number, typeof taskItems>();
    for (const item of taskItems) {
      const existing = taskItemsByPost.get(item.postId) || [];
      existing.push(item);
      taskItemsByPost.set(item.postId, existing);
    }

    // Fetch sender info
    const senderIds = Array.from(new Set(paginatedPosts.map((p) => p.senderUserId)));
    const senders =
      senderIds.length > 0
        ? await db.select().from(users).where(inArray(users.id, senderIds))
        : [];
    const sendersMap = new Map(senders.map((u) => [u.id, u]));

    const formattedPosts = paginatedPosts.map((post) => {
      const sender = sendersMap.get(post.senderUserId);
      return {
        id: post.id,
        conversationId: post.conversationId,
        type: post.type,
        content: post.content,
        imageUrl: post.imageUrl,
        isRead: post.isRead,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        sender: sender
          ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl }
          : null,
        taskItems: post.type === 'task' ? (taskItemsByPost.get(post.id) || []) : undefined,
      };
    });

    return Response.json({
      success: true,
      data: { posts: formattedPosts, hasMore },
    });
  } catch (error) {
    console.error('Error fetching iConnect posts:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch posts' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'iconnect-posts-create');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((e: { message: string }) => e.message).join(', '),
          },
        },
        { status: 400 }
      );
    }

    const { conversationId, type, content, imageUrl, taskItems: taskItemsInput } = parsed.data;

    const conversation = await verifyConversationMembership(conversationId, userId);
    if (!conversation) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this conversation' } },
        { status: 403 }
      );
    }

    if (type === 'task' && taskItemsInput) {
      // Use transaction for task posts (post + task items)
      const result = await db.transaction(async (tx) => {
        const [post] = await tx
          .insert(iconnectPosts)
          .values({
            conversationId,
            senderUserId: userId,
            type,
            content: content || null,
            imageUrl: null,
          })
          .returning();

        const items = await tx
          .insert(iconnectTaskItems)
          .values(taskItemsInput.map((item) => ({ postId: post.id, label: item.label })))
          .returning();

        return { post, taskItems: items };
      });

      const sender = await db.query.users.findFirst({ where: eq(users.id, userId) });

      const postPayload = {
        id: result.post.id,
        conversationId: result.post.conversationId,
        type: result.post.type,
        content: result.post.content,
        imageUrl: result.post.imageUrl,
        isRead: result.post.isRead,
        createdAt: result.post.createdAt,
        updatedAt: result.post.updatedAt,
        sender: sender
          ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl }
          : null,
        taskItems: result.taskItems,
      };

      // Emit real-time event to the other user
      const recipientId =
        conversation.coachId === userId ? conversation.clientId : conversation.coachId;
      emitIConnectPostEvents(recipientId, postPayload, conversationId);

      return Response.json({ success: true, data: { post: postPayload } });
    }

    // Non-task posts
    const [post] = await db
      .insert(iconnectPosts)
      .values({
        conversationId,
        senderUserId: userId,
        type,
        content: content || null,
        imageUrl: imageUrl || null,
      })
      .returning();

    const sender = await db.query.users.findFirst({ where: eq(users.id, userId) });

    const postPayload = {
      id: post.id,
      conversationId: post.conversationId,
      type: post.type,
      content: post.content,
      imageUrl: post.imageUrl,
      isRead: post.isRead,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      sender: sender
        ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl }
        : null,
      taskItems: undefined,
    };

    // Emit real-time event to the other user
    const recipientId =
      conversation.coachId === userId ? conversation.clientId : conversation.coachId;
    emitIConnectPostEvents(recipientId, postPayload, conversationId);

    return Response.json({ success: true, data: { post: postPayload } });
  } catch (error) {
    console.error('Error creating iConnect post:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create post' } },
      { status: 500 }
    );
  }
}
