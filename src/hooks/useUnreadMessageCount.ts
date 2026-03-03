'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSocket } from './useSocket';
import { getUnreadMessageCount } from '@/app/(dashboard)/dashboard/messages/actions';

const POLL_INTERVAL = 600_000; // 10min safety net — real-time updates via Socket.io

/**
 * Hook that tracks unread message count in real-time via Socket.io.
 * Increments on new message notifications, reconciles from server on navigation,
 * and polls as a fallback when socket events are missed.
 */
export function useUnreadMessageCount(initialCount: number) {
  const [count, setCount] = useState(initialCount);
  const { socket } = useSocket();
  const pathname = usePathname();
  const hasFetchedRef = useRef(false);
  const lastDisconnectRef = useRef<number | null>(null);

  // Sync with server-rendered count when it changes (full page navigation)
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  const refetchCount = useCallback(async () => {
    const result = await getUnreadMessageCount();
    if (result.success && result.count !== undefined) {
      setCount(result.count);
    }
  }, []);

  // Increment when a new message notification arrives (recipient-only event)
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: { type: string }, ack?: (response: { received: boolean }) => void) => {
      if (data.type === 'new_message') {
        // If user is currently on a messages page, refetch the true count
        // (the message might be for the conversation they're viewing)
        if (window.location.pathname.startsWith('/dashboard/messages/')) {
          refetchCount();
        } else {
          setCount((prev) => prev + 1);
        }
      }
      // Acknowledge receipt to server
      if (typeof ack === 'function') ack({ received: true });
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, refetchCount]);

  // Reconnect catchup: refetch count when socket reconnects after a disconnect
  useEffect(() => {
    if (!socket) return;

    const handleDisconnect = () => {
      lastDisconnectRef.current = Date.now();
    };

    const handleConnect = () => {
      if (lastDisconnectRef.current !== null) {
        refetchCount();
        lastDisconnectRef.current = null;
      }
    };

    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);
    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
    };
  }, [socket, refetchCount]);

  // Refetch unread count when tab regains focus (catches messages missed while backgrounded)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetchCount]);

  // Poll as a fallback — keeps badge accurate even if socket events are missed
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      refetchCount();
    }

    const interval = setInterval(refetchCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refetchCount]);

  // Reconcile count from server when navigating (e.g., after reading messages)
  useEffect(() => {
    refetchCount();
  }, [pathname, refetchCount]);

  return count;
}
