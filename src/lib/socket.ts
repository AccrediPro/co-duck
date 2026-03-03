'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let consumerCount = 0;
let tokenGetter: (() => Promise<string | null>) | null = null;

/**
 * Store the token getter so the socket can refresh tokens on reconnection.
 * Must be called before initSocket.
 */
export function setTokenGetter(getter: () => Promise<string | null>): void {
  tokenGetter = getter;
}

export function initSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io({
    path: '/api/socketio',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Refresh the Clerk JWT before every reconnection attempt.
  // Clerk tokens expire after ~60s, so without this the socket
  // silently fails to reconnect after the first disconnect.
  socket.on('reconnect_attempt', async () => {
    if (tokenGetter && socket) {
      try {
        const freshToken = await tokenGetter();
        if (freshToken) {
          socket.auth = { token: freshToken };
        }
      } catch {
        // Token refresh failed — socket.io will retry with the old token
      }
    }
  });

  socket.on('connect', () => {
    console.log('[socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] Connection error:', err.message);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

/** Register a consumer of the shared socket. Call releaseSocket() on cleanup. */
export function acquireSocket(): void {
  consumerCount++;
}

/** Unregister a consumer. Only disconnects when the last consumer releases. */
export function releaseSocket(): void {
  consumerCount = Math.max(0, consumerCount - 1);
  if (consumerCount === 0) {
    disconnectSocket();
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
