import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { iconnectComments, iconnectPosts, conversations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { getSocketServer } from '@/lib/socket-server';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(request, WRITE_LIMIT, 'iconnect-comments-delete');
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
    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return Response.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid comment ID' } },
        { status: 400 }
      );
    }

    const comment = await db.query.iconnectComments.findFirst({
      where: eq(iconnectComments.id, commentId),
    });

    if (!comment) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Comment not found' } },
        { status: 404 }
      );
    }

    if (comment.senderUserId !== userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the sender can delete this comment' },
        },
        { status: 403 }
      );
    }

    const postId = comment.postId;
    await db.delete(iconnectComments).where(eq(iconnectComments.id, commentId));

    // Emit real-time event to the other user (fire-and-forget)
    try {
      const io = getSocketServer();
      if (io) {
        const post = await db.query.iconnectPosts.findFirst({
          where: eq(iconnectPosts.id, postId),
        });
        if (post) {
          const conversation = await db.query.conversations.findFirst({
            where: eq(conversations.id, post.conversationId),
          });
          if (conversation) {
            const recipientId =
              conversation.coachId === userId ? conversation.clientId : conversation.coachId;
            io.to(`user:${recipientId}`).emit('iconnect:comment_deleted', {
              commentId,
              postId,
            });
          }
        }
      }
    } catch {
      // Fire-and-forget — socket emit failures must not break the response
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting iConnect comment:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete comment' } },
      { status: 500 }
    );
  }
}
