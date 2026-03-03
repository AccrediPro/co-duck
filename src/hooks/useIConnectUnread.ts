'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSocket } from './useSocket';
import { getIConnectUnreadCount } from '@/app/(dashboard)/dashboard/iconnect/actions';

const POLL_INTERVAL = 600_000; // 10min safety net — real-time updates via Socket.io

/**
 * Hook that tracks unread iConnect post count in real-time via Socket.io.
 * Increments on `iconnect:unread_update`, decrements on `iconnect:posts_read`,
 * reconciles from server on navigation, and polls as a fallback.
 *
 * Follows the exact pattern of useUnreadMessageCount.
 */
export function useIConnectUnread(initialCount: number) {
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
    const result = await getIConnectUnreadCount();
    if (result.success && result.count !== undefined) {
      setCount(result.count);
    }
  }, []);

  // Listen for new iConnect post events — the server sends totalUnreadCount
  useEffect(() => {
    if (!socket) return;

    const handleUnreadUpdate = (data: { conversationId: number; totalUnreadCount: number }) => {
      // If user is currently viewing an iConnect feed, refetch true count
      // (the post might be for the conversation they're viewing, which auto-marks as read)
      if (window.location.pathname.startsWith('/dashboard/iconnect/')) {
        refetchCount();
      } else {
        setCount(data.totalUnreadCount);
      }
    };

    const handlePostsRead = (data: { conversationId: number; markedCount: number }) => {
      // Posts were marked as read — decrement the count
      setCount((prev) => Math.max(0, prev - data.markedCount));
    };

    socket.on('iconnect:unread_update', handleUnreadUpdate);
    socket.on('iconnect:posts_read', handlePostsRead);

    return () => {
      socket.off('iconnect:unread_update', handleUnreadUpdate);
      socket.off('iconnect:posts_read', handlePostsRead);
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

  // Refetch unread count when tab regains focus
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

  // Poll as a fallback
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      refetchCount();
    }

    const interval = setInterval(refetchCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refetchCount]);

  // Reconcile count from server when navigating (e.g., after reading posts)
  useEffect(() => {
    refetchCount();
  }, [pathname, refetchCount]);

  return count;
}
