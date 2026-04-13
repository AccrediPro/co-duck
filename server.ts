import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '@clerk/backend';
import { parse } from 'url';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3001', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Connected users: userId → Set<socketId>
const connectedUsers = new Map<string, Set<string>>();

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    connectTimeout: 45000,
    cors: {
      origin: dev
        ? true // Allow all origins in dev (mobile connects from LAN IP)
        : ([
            `http://localhost:${port}`,
            `https://localhost:${port}`,
            process.env.NEXT_PUBLIC_APP_URL,
          ].filter(Boolean) as string[]),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Store io instance for use in API routes
  const { setSocketServer } = await import('./src/lib/socket-server');
  setSocketServer(io);

  // ── Authentication Middleware ──────────────────────────────────────────

  io.use(async (socket, nextFn) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;

      if (!token) {
        return nextFn(new Error('Authentication required'));
      }

      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      const userId = payload.sub;
      if (!userId) {
        return nextFn(new Error('Invalid token: no subject'));
      }

      socket.data.userId = userId;
      nextFn();
    } catch (err) {
      console.error('[socket.io] Auth error:', err);
      nextFn(new Error('Authentication failed'));
    }
  });

  // ── Connection Handler ────────────────────────────────────────────────

  io.on('connection', async (socket) => {
    const userId: string = socket.data.userId;
    const isReconnect = connectedUsers.has(userId);
    console.log(
      `[socket.io] User ${isReconnect ? 'reconnected' : 'connected'}: ${userId} (socket: ${socket.id})`
    );

    // Track connected user
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId)!.add(socket.id);

    // Join personal room for targeted notifications
    socket.join(`user:${userId}`);

    // ── Room Management ───────────────────────────────────────────────

    socket.on('conversation:join', async (data: { conversationId: number }) => {
      try {
        const { conversationId } = data;
        if (!conversationId) return;

        // Verify user is a participant in this conversation
        const { db } = await import('./src/db');
        const { conversations } = await import('./src/db/schema');
        const { eq, and, or } = await import('drizzle-orm');

        const conversation = await db.query.conversations.findFirst({
          where: and(
            eq(conversations.id, conversationId),
            or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
          ),
        });

        if (!conversation) {
          socket.emit('error', { message: 'Not a participant in this conversation' });
          return;
        }

        const room = `conversation:${conversationId}`;
        socket.join(room);
        console.log(`[socket.io] ${userId} joined room ${room}`);

        // Emit presence to others in the room
        socket.to(room).emit('presence:update', {
          userId,
          status: 'online',
        });
      } catch (err) {
        console.error('[socket.io] conversation:join error:', err);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    socket.on('conversation:leave', (data: { conversationId: number }) => {
      const { conversationId } = data;
      if (!conversationId) return;

      const room = `conversation:${conversationId}`;
      socket.leave(room);
      console.log(`[socket.io] ${userId} left room ${room}`);
    });

    // ── Message Sending ─────────────────────────────────────────────────

    socket.on('message:send', async (data: { conversationId: number; content: string }) => {
      try {
        const { conversationId, content } = data;

        if (
          !conversationId ||
          !content ||
          typeof content !== 'string' ||
          content.trim().length === 0
        ) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }

        const { db } = await import('./src/db');
        const { conversations, messages, users, notifications } = await import('./src/db/schema');
        const { eq, and, or } = await import('drizzle-orm');

        // Verify user is a participant
        const conversation = await db.query.conversations.findFirst({
          where: and(
            eq(conversations.id, conversationId),
            or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
          ),
        });

        if (!conversation) {
          socket.emit('error', { message: 'Not a participant in this conversation' });
          return;
        }

        // Insert message
        const [newMessage] = await db
          .insert(messages)
          .values({
            conversationId,
            senderId: userId,
            content: content.trim(),
            messageType: 'text',
            isRead: false,
          })
          .returning();

        // Update conversation lastMessageAt
        await db
          .update(conversations)
          .set({ lastMessageAt: newMessage.createdAt })
          .where(eq(conversations.id, conversationId));

        // Get sender info
        const sender = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });

        // Determine recipient
        const recipientId =
          conversation.coachId === userId ? conversation.clientId : conversation.coachId;

        // Create notification for recipient and emit via Socket.io
        const notifBody =
          content.trim().length > 100 ? content.trim().slice(0, 100) + '...' : content.trim();
        await db
          .insert(notifications)
          .values({
            userId: recipientId,
            type: 'new_message',
            title: `New message from ${sender?.name || 'Someone'}`,
            message: notifBody,
            body: notifBody,
            link: `/dashboard/messages/${conversationId}`,
          })
          .returning()
          .then(([inserted]) => {
            if (inserted) {
              io.to(`user:${recipientId}`)
                .timeout(5000)
                .emit(
                  'notification:new',
                  {
                    id: inserted.id,
                    type: inserted.type,
                    title: inserted.title,
                    body: inserted.body,
                    link: inserted.link,
                    isRead: inserted.isRead,
                    createdAt: inserted.createdAt,
                  },
                  (err: Error | null) => {
                    if (err) {
                      console.warn(
                        `[socket.io] Notification not acknowledged by ${recipientId} within 5s (type: ${inserted.type})`
                      );
                    }
                  }
                );
            }
          })
          .catch((err: unknown) => {
            console.error('[socket.io] Failed to create notification:', err);
          });

        // Build the message payload
        const messagePayload = {
          id: newMessage.id,
          content: newMessage.content,
          messageType: newMessage.messageType,
          isRead: newMessage.isRead,
          createdAt: newMessage.createdAt,
          conversationId,
          sender: sender
            ? {
                id: sender.id,
                name: sender.name,
                avatarUrl: sender.avatarUrl,
              }
            : null,
          senderId: userId,
        };

        // Broadcast to room (including sender for confirmation)
        const room = `conversation:${conversationId}`;
        io.to(room).emit('message:new', messagePayload);

        // Notify both users about conversation update (for list ordering)
        io.to(room).emit('conversation:updated', {
          conversationId,
          lastMessageAt: newMessage.createdAt,
          lastMessageContent: content.trim(),
          lastMessageSenderId: userId,
        });

        // Also emit to recipient sockets that may not be in the room
        // (e.g., they're on the conversation list page, not in a specific chat)
        const recipientSockets = connectedUsers.get(recipientId);
        if (recipientSockets) {
          Array.from(recipientSockets).forEach((socketId) => {
            const recipientSocket = io.sockets.sockets.get(socketId);
            if (recipientSocket && !recipientSocket.rooms.has(room)) {
              recipientSocket.emit('conversation:updated', {
                conversationId,
                lastMessageAt: newMessage.createdAt,
                lastMessageContent: content.trim(),
                lastMessageSenderId: userId,
              });
            }
          });
        }

        // Send push notification if recipient is not actively viewing the conversation
        const roomMembers = io.sockets.adapter.rooms.get(room);
        const recipientInRoom =
          recipientSockets && roomMembers
            ? Array.from(recipientSockets).some((sid) => roomMembers.has(sid))
            : false;

        if (!recipientInRoom) {
          const { sendPushNotification } = await import('./src/lib/push-notifications');
          sendPushNotification(recipientId, {
            title: `New message from ${sender?.name || 'Someone'}`,
            body: notifBody,
            data: {
              type: 'new_message',
              link: `/dashboard/messages/${conversationId}`,
              conversationId: String(conversationId),
            },
          });
        }
      } catch (err) {
        console.error('[socket.io] message:send error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Typing Indicators ───────────────────────────────────────────────

    socket.on('typing:start', (data: { conversationId: number }) => {
      const { conversationId } = data;
      if (!conversationId) return;

      const room = `conversation:${conversationId}`;
      socket.to(room).emit('typing:start', { userId });
    });

    socket.on('typing:stop', (data: { conversationId: number }) => {
      const { conversationId } = data;
      if (!conversationId) return;

      const room = `conversation:${conversationId}`;
      socket.to(room).emit('typing:stop', { userId });
    });

    // ── Read Receipts ───────────────────────────────────────────────────

    socket.on('messages:read', async (data: { conversationId: number }) => {
      try {
        const { conversationId } = data;
        if (!conversationId) return;

        const { db } = await import('./src/db');
        const { messages, conversations } = await import('./src/db/schema');
        const { eq, and, ne, or } = await import('drizzle-orm');

        // Verify user is a participant
        const conversation = await db.query.conversations.findFirst({
          where: and(
            eq(conversations.id, conversationId),
            or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
          ),
        });

        if (!conversation) return;

        // Mark all messages NOT from this user as read
        await db
          .update(messages)
          .set({ isRead: true })
          .where(
            and(
              eq(messages.conversationId, conversationId),
              ne(messages.senderId, userId),
              eq(messages.isRead, false)
            )
          );

        // Broadcast read receipt to the room
        const room = `conversation:${conversationId}`;
        socket.to(room).emit('messages:read', {
          conversationId,
          readBy: userId,
        });
      } catch (err) {
        console.error('[socket.io] messages:read error:', err);
      }
    });

    // ── Disconnect ──────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      console.log(
        `[socket.io] User disconnected: ${userId} (socket: ${socket.id}, reason: ${reason})`
      );

      // Remove socket from user's set
      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }

      // Notify rooms this socket was in about offline status
      // Only if user has NO other connected sockets
      if (!connectedUsers.has(userId)) {
        Array.from(socket.rooms).forEach((room) => {
          if (room.startsWith('conversation:')) {
            socket.to(room).emit('presence:update', {
              userId,
              status: 'offline',
            });
          }
        });
      }
    });
  });

  // ── Graceful Shutdown ───────────────────────────────────────────────────

  const shutdown = () => {
    console.log('[server] Shutting down...');
    io.close(() => {
      httpServer.close(() => {
        console.log('[server] Closed.');
        process.exit(0);
      });
    });
    // Force exit after 10 seconds
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server on ws://${hostname}:${port}/api/socketio`);
  });
});
