import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { iconnectPosts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

const updatePostSchema = z.object({
  content: z.string().min(1).max(5000),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(request, WRITE_LIMIT, 'iconnect-posts-update');
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

    const post = await db.query.iconnectPosts.findFirst({
      where: eq(iconnectPosts.id, postId),
    });

    if (!post) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } },
        { status: 404 }
      );
    }

    if (post.senderUserId !== userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the sender can edit this post' },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updatePostSchema.safeParse(body);
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

    const [updated] = await db
      .update(iconnectPosts)
      .set({ content: parsed.data.content, updatedAt: new Date() })
      .where(eq(iconnectPosts.id, postId))
      .returning();

    return Response.json({
      success: true,
      data: {
        post: {
          id: updated.id,
          conversationId: updated.conversationId,
          type: updated.type,
          content: updated.content,
          imageUrl: updated.imageUrl,
          isRead: updated.isRead,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Error updating iConnect post:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update post' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(request, WRITE_LIMIT, 'iconnect-posts-delete');
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

    const post = await db.query.iconnectPosts.findFirst({
      where: eq(iconnectPosts.id, postId),
    });

    if (!post) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } },
        { status: 404 }
      );
    }

    if (post.senderUserId !== userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the sender can delete this post' },
        },
        { status: 403 }
      );
    }

    await db.delete(iconnectPosts).where(eq(iconnectPosts.id, postId));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting iConnect post:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete post' } },
      { status: 500 }
    );
  }
}
