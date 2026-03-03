import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { iconnectPosts, conversations } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { getSocketServer } from '@/lib/socket-server';

const markReadSchema = z.object({
  conversationId: z.number().int().positive(),
});

export async function POST(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'iconnect-posts-mark-read');
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
    const parsed = markReadSchema.safeParse(body);
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

    const { conversationId } = parsed.data;

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation || (conversation.coachId !== userId && conversation.clientId !== userId)) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this conversation' } },
        { status: 403 }
      );
    }

    // Mark all posts from the other user as read
    const result = await db
      .update(iconnectPosts)
      .set({ isRead: true })
      .where(
        and(
          eq(iconnectPosts.conversationId, conversationId),
          ne(iconnectPosts.senderUserId, userId),
          eq(iconnectPosts.isRead, false)
        )
      )
      .returning({ id: iconnectPosts.id });

    // Emit socket event so the user's own sidebar badge updates
    if (result.length > 0) {
      try {
        const io = getSocketServer();
        if (io) {
          io.to(`user:${userId}`).emit('iconnect:posts_read', {
            conversationId,
            markedCount: result.length,
          });
        }
      } catch {
        // Fire-and-forget
      }
    }

    return Response.json({
      success: true,
      data: { markedCount: result.length },
    });
  } catch (error) {
    console.error('Error marking iConnect posts as read:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark posts as read' } },
      { status: 500 }
    );
  }
}
