'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { Socket } from 'socket.io-client';
import { initSocket, setTokenGetter, acquireSocket, releaseSocket } from '@/lib/socket';

export type ConnectionHealth = 'healthy' | 'reconnecting' | 'disconnected';

export function useSocket() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [isConnected, setIsConnected] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>('disconnected');
  const [socket, setSocket] = useState<Socket | null>(null);
  const initializedRef = useRef(false);
  const lastVisibleTimestampRef = useRef(Date.now());

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let mounted = true;
    acquireSocket();

    async function connect() {
      try {
        // Store the token getter so the socket can refresh on reconnection
        setTokenGetter(getTokenRef.current);

        const token = await getTokenRef.current();
        if (!token || !mounted) return;

        const s = initSocket(token);

        const onConnect = () => {
          if (mounted) {
            setIsConnected(true);
            setConnectionHealth('healthy');
            setSocket(s);
          }
        };
        const onDisconnect = () => {
          if (mounted) {
            setIsConnected(false);
            setConnectionHealth('disconnected');
          }
        };
        const onReconnectAttempt = () => {
          if (mounted) {
            setConnectionHealth('reconnecting');
          }
        };

        s.on('connect', onConnect);
        s.on('disconnect', onDisconnect);
        s.on('reconnect_attempt', onReconnectAttempt);

        // If already connected (singleton reused), update state immediately
        if (s.connected) {
          setIsConnected(true);
          setConnectionHealth('healthy');
        }
        // Always expose the socket so consumers can attach listeners
        if (mounted) {
          setSocket(s);
        }
      } catch (err) {
        console.error('[useSocket] Failed to initialize:', err);
      }
    }

    connect();

    return () => {
      mounted = false;
      releaseSocket();
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnect stale socket when tab regains focus
  const handleVisibilityReconnect = useCallback(async () => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') {
      lastVisibleTimestampRef.current = Date.now();
      return;
    }

    const backgroundDuration = Date.now() - lastVisibleTimestampRef.current;
    lastVisibleTimestampRef.current = Date.now();

    if (!socket) return;

    // If socket disconnected while backgrounded, force reconnect with fresh token
    if (!socket.connected && backgroundDuration > 5_000) {
      try {
        const token = await getTokenRef.current();
        if (token) {
          socket.auth = { token };
          socket.connect();
        }
      } catch {
        // Token refresh failed — socket.io will retry automatically
      }
    }
  }, [socket]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', handleVisibilityReconnect);
    return () => document.removeEventListener('visibilitychange', handleVisibilityReconnect);
  }, [handleVisibilityReconnect]);

  return { socket, isConnected, connectionHealth, lastVisibleTimestampRef };
}
