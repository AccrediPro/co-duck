import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { iconnectTaskItems, iconnectPosts, conversations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(request, WRITE_LIMIT, 'iconnect-tasks-toggle');
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
    const taskItemId = parseInt(id);
    if (isNaN(taskItemId)) {
      return Response.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid task item ID' } },
        { status: 400 }
      );
    }

    // Look up task item -> post -> conversation to verify membership
    const taskItem = await db.query.iconnectTaskItems.findFirst({
      where: eq(iconnectTaskItems.id, taskItemId),
    });

    if (!taskItem) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task item not found' } },
        { status: 404 }
      );
    }

    const post = await db.query.iconnectPosts.findFirst({
      where: eq(iconnectPosts.id, taskItem.postId),
    });

    if (!post) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Associated post not found' } },
        { status: 404 }
      );
    }

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, post.conversationId),
    });

    if (!conversation || (conversation.coachId !== userId && conversation.clientId !== userId)) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not a member of this conversation' },
        },
        { status: 403 }
      );
    }

    // Toggle completed state
    const newCompleted = !taskItem.completed;
    const [updated] = await db
      .update(iconnectTaskItems)
      .set({
        completed: newCompleted,
        completedAt: newCompleted ? new Date() : null,
      })
      .where(eq(iconnectTaskItems.id, taskItemId))
      .returning();

    return Response.json({
      success: true,
      data: { taskItem: updated },
    });
  } catch (error) {
    console.error('Error toggling iConnect task item:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle task item' } },
      { status: 500 }
    );
  }
}
