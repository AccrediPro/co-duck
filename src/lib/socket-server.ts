import type { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setSocketServer(server: SocketIOServer): void {
  io = server;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Emit a notification to a specific user via Socket.io.
 * Uses the user's personal room (`user:<userId>`).
 * Non-blocking — silently skips if Socket.io is not available.
 */
export function emitNotification(
  userId: string,
  notification: {
    id: number;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    isRead: boolean;
    createdAt: Date;
  }
): void {
  try {
    if (!io) return;
    io.to(`user:${userId}`)
      .timeout(5000)
      .emit('notification:new', notification, (err: Error | null) => {
        if (err) {
          console.warn(
            `[socket] Notification not acknowledged by ${userId} within 5s (type: ${notification.type})`
          );
        }
      });
  } catch {
    // Fire-and-forget — notification emit failures must not break the caller
  }
}
