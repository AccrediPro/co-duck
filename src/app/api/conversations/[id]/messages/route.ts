/**
 * @fileoverview Conversation Messages API
 *
 * Get and send messages in a conversation.
 * Supports text messages and file attachments (FormData).
 *
 * @module api/conversations/[id]/messages
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { conversations, messages, users } from '@/db/schema';
import { eq, or, and, desc, inArray, lt } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';
import { NewMessageEmail } from '@/lib/emails';
import { createNotification } from '@/lib/notifications';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';
import { getSocketServer } from '@/lib/socket-server';
import { uploadMessageAttachment } from '@/lib/file-upload';
import { extractUrls, fetchLinkPreview } from '@/lib/link-preview';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id/messages
 *
 * Returns messages in a conversation (paginated, newest first).
 *
 * @param {string} id - Conversation ID
 * @query {number} [limit=50] - Messages to fetch
 * @query {string} [before] - Cursor for pagination (message ID)
 *
 * @returns {Object} Paginated messages
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const conversationId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const before = searchParams.get('before');

    if (isNaN(conversationId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid conversation ID' } },
        { status: 400 }
      );
    }

    // Verify access to conversation
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
      ),
    });

    if (!conversation) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    // Build query conditions
    const conditions = [eq(messages.conversationId, conversationId)];

    if (before) {
      const beforeId = parseInt(before);
      if (!isNaN(beforeId)) {
        conditions.push(lt(messages.id, beforeId));
      }
    }

    // Get messages
    const messageList = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1); // Fetch one extra to check if there are more

    const hasMore = messageList.length > limit;
    const paginatedMessages = hasMore ? messageList.slice(0, -1) : messageList;

    // Get sender info
    const senderIds = Array.from(new Set(paginatedMessages.map((m) => m.senderId)));
    const sendersData = senderIds.length
      ? await db.select().from(users).where(inArray(users.id, senderIds))
      : [];
    const sendersMap = new Map(sendersData.map((u) => [u.id, u]));

    // Format response
    const formattedMessages = paginatedMessages.map((msg) => {
      const sender = sendersMap.get(msg.senderId);
      return {
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
        sender: sender
          ? {
              id: sender.id,
              name: sender.name,
              avatarUrl: sender.avatarUrl,
            }
          : null,
        isOwnMessage: msg.senderId === userId,
        attachment: msg.attachmentUrl
          ? {
              url: msg.attachmentUrl,
              name: msg.attachmentName,
              type: msg.attachmentType,
              size: msg.attachmentSize,
            }
          : null,
        metadata: msg.metadata ?? null,
      };
    });

    // Reverse to get chronological order
    formattedMessages.reverse();

    return Response.json({
      success: true,
      data: {
        messages: formattedMessages,
        hasMore,
        nextCursor: hasMore ? paginatedMessages[paginatedMessages.length - 1]?.id.toString() : null,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch messages' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/:id/messages
 *
 * Sends a message in a conversation. Supports two content types:
 * - application/json: { content: string } for text-only messages
 * - multipart/form-data: file (File) + content (string, optional) for attachments
 *
 * @param {string} id - Conversation ID
 *
 * @returns {Object} Created message with optional attachment
 */
export async function POST(request: Request, { params }: RouteParams) {
  const contentType = request.headers.get('content-type') || '';
  const isFormData = contentType.includes('multipart/form-data');

  // Stricter rate limit for file uploads
  const limitConfig = isFormData ? WRITE_LIMIT : FREQUENT_LIMIT;
  const rl = rateLimit(request, limitConfig, isFormData ? 'messages-upload' : 'messages-send');
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
    const conversationId = parseInt(id);

    if (isNaN(conversationId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid conversation ID' } },
        { status: 400 }
      );
    }

    // Parse content and file based on content type
    let content: string | null = null;
    let file: File | null = null;

    if (isFormData) {
      const formData = await request.formData();
      const rawContent = formData.get('content');
      content = typeof rawContent === 'string' ? rawContent.trim() : null;
      file = formData.get('file') as File | null;
    } else {
      const body = await request.json();
      content = typeof body.content === 'string' ? body.content.trim() : null;
    }

    // Must have at least content or a file
    if ((!content || content.length === 0) && !file) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_CONTENT', message: 'Message content or file is required' },
        },
        { status: 400 }
      );
    }

    // Verify access to conversation
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
      ),
    });

    if (!conversation) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    // Upload attachment if present
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    let attachmentType: string | null = null;
    let attachmentSize: number | null = null;

    if (file) {
      const uploadResult = await uploadMessageAttachment(file, conversationId, userId);
      if ('error' in uploadResult) {
        return Response.json(
          { success: false, error: uploadResult.error },
          { status: 400 }
        );
      }
      attachmentUrl = uploadResult.data.url;
      attachmentName = uploadResult.data.fileName;
      attachmentType = uploadResult.data.fileType;
      attachmentSize = uploadResult.data.fileSize;
    }

    // Create message
    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId,
        senderId: userId,
        content: content || '',
        messageType: 'text',
        isRead: false,
        attachmentUrl,
        attachmentName,
        attachmentType,
        attachmentSize,
      })
      .returning();

    // Update conversation's lastMessageAt
    await db
      .update(conversations)
      .set({ lastMessageAt: newMessage.createdAt })
      .where(eq(conversations.id, conversationId));

    // Get sender info
    const sender = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    // In-app notification for the other party
    const recipientId =
      conversation.coachId === userId ? conversation.clientId : conversation.coachId;

    const notificationBody = attachmentName
      ? `Sent a file: ${attachmentName}`
      : content && content.length > 100
        ? content.slice(0, 100) + '...'
        : content || '';

    createNotification({
      userId: recipientId,
      type: 'new_message',
      title: `New message from ${sender?.name || 'Someone'}`,
      body: notificationBody,
      link: `/dashboard/messages/${conversationId}`,
    });

    // Send email notification to the other party (non-blocking)
    const recipient = await db.query.users.findFirst({
      where: eq(users.id, recipientId),
    });
    if (recipient?.email && sender) {
      const emailPreview = attachmentName
        ? `Sent a file: ${attachmentName}`
        : content || '';

      sendEmail({
        to: recipient.email,
        subject: `New message from ${sender.name || 'your coach'}`,
        react: NewMessageEmail({
          recipientName: recipient.name || 'there',
          senderName: sender.name || 'Someone',
          messagePreview: emailPreview,
          conversationId,
          unsubscribeUrl: getUnsubscribeUrl(recipientId, 'messages'),
        }),
      }).catch((err) => {
        console.error('Failed to send new message email:', err);
      });
    }

    // Build response and Socket.io payload
    const attachment = newMessage.attachmentUrl
      ? {
          url: newMessage.attachmentUrl,
          name: newMessage.attachmentName,
          type: newMessage.attachmentType,
          size: newMessage.attachmentSize,
        }
      : null;

    // Emit via Socket.io for real-time delivery
    const io = getSocketServer();
    if (io) {
      const room = `conversation:${conversationId}`;
      const messagePayload = {
        id: newMessage.id,
        content: newMessage.content,
        messageType: newMessage.messageType,
        isRead: newMessage.isRead,
        createdAt: newMessage.createdAt,
        conversationId,
        sender: sender
          ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl }
          : null,
        senderId: userId,
        attachment,
        metadata: null,
      };
      io.to(room).emit('message:new', messagePayload);
      io.to(room).emit('conversation:updated', {
        conversationId,
        lastMessageAt: newMessage.createdAt,
        lastMessageContent: content || (attachmentName ? `Sent a file: ${attachmentName}` : ''),
        lastMessageSenderId: userId,
      });
    }

    // Async link preview: don't block the response
    if (content) {
      const urls = extractUrls(content);
      if (urls.length > 0) {
        fetchLinkPreview(urls[0])
          .then(async (preview) => {
            if (!preview) return;
            const metadata = { linkPreview: preview };
            await db
              .update(messages)
              .set({ metadata })
              .where(eq(messages.id, newMessage.id));
            // Notify connected clients of the updated metadata
            if (io) {
              const room = `conversation:${conversationId}`;
              io.to(room).emit('message:updated', {
                id: newMessage.id,
                conversationId,
                metadata,
              });
            }
          })
          .catch((err) => {
            console.error('Failed to fetch link preview:', err);
          });
      }
    }

    return Response.json({
      success: true,
      data: {
        id: newMessage.id,
        content: newMessage.content,
        messageType: newMessage.messageType,
        isRead: newMessage.isRead,
        createdAt: newMessage.createdAt,
        sender: sender
          ? {
              id: sender.id,
              name: sender.name,
              avatarUrl: sender.avatarUrl,
            }
          : null,
        isOwnMessage: true,
        attachment,
        metadata: null,
      },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' } },
      { status: 500 }
    );
  }
}
