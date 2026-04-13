import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { iconnectComments, iconnectPosts, conversations, users } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit, WRITE_LIMIT, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { getSocketServer } from '@/lib/socket-server';

const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

async function verifyPostMembership(postId: number, userId: string) {
  const post = await db.query.iconnectPosts.findFirst({
    where: eq(iconnectPosts.id, postId),
  });
  if (!post) return null;

  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, post.conversationId),
  });
  if (!conversation) return null;
  if (conversation.coachId !== userId && conversation.clientId !== userId) return null;

  return { post, conversation };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'iconnect-comments-list');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return Response.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid post ID' } },
        { status: 400 }
      );
    }

    const membership = await verifyPostMembership(postId, userId);
    if (!membership) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not a member of this conversation' },
        },
        { status: 403 }
      );
    }

    const comments = await db
      .select({
        id: iconnectComments.id,
        postId: iconnectComments.postId,
        senderUserId: iconnectComments.senderUserId,
        content: iconnectComments.content,
        createdAt: iconnectComments.createdAt,
        updatedAt: iconnectComments.updatedAt,
        sender: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(iconnectComments)
      .innerJoin(users, eq(iconnectComments.senderUserId, users.id))
      .where(eq(iconnectComments.postId, postId))
      .orderBy(asc(iconnectComments.createdAt));

    return Response.json({
      success: true,
      data: { comments },
    });
  } catch (error) {
    console.error('Error fetching iConnect comments:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch comments' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(request, WRITE_LIMIT, 'iconnect-comments-create');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return Response.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid post ID' } },
        { status: 400 }
      );
    }

    const membership = await verifyPostMembership(postId, userId);
    if (!membership) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not a member of this conversation' },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);
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

    const [comment] = await db
      .insert(iconnectComments)
      .values({
        postId,
        senderUserId: userId,
        content: parsed.data.content,
      })
      .returning();

    const sender = await db.query.users.findFirst({ where: eq(users.id, userId) });

    const commentPayload = {
      id: comment.id,
      postId: comment.postId,
      senderUserId: comment.senderUserId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      sender: sender ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl } : null,
    };

    // Emit real-time event to the other user (fire-and-forget)
    try {
      const io = getSocketServer();
      if (io) {
        const recipientId =
          membership.conversation.coachId === userId
            ? membership.conversation.clientId
            : membership.conversation.coachId;
        io.to(`user:${recipientId}`).emit('iconnect:new_comment', {
          comment: commentPayload,
          postId,
        });
      }
    } catch {
      // Fire-and-forget — socket emit failures must not break the response
    }

    return Response.json({
      success: true,
      data: { comment: commentPayload },
    });
  } catch (error) {
    console.error('Error creating iConnect comment:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create comment' } },
      { status: 500 }
    );
  }
}
