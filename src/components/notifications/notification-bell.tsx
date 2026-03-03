'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Calendar,
  MessageSquare,
  Star,
  CheckSquare,
  Loader2,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDateShort } from '@/lib/date-utils';
import { useSocket } from '@/hooks/useSocket';

type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'session_completed'
  | 'new_message'
  | 'new_review'
  | 'review_response'
  | 'action_item'
  | 'session_reminder'
  | 'system';

interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    unreadCount: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

const NOTIFICATION_ICONS: Record<NotificationType, typeof Bell> = {
  booking_confirmed: Calendar,
  booking_cancelled: Calendar,
  session_completed: Calendar,
  new_message: MessageSquare,
  new_review: Star,
  review_response: Star,
  action_item: CheckSquare,
  session_reminder: Calendar,
  system: Bell,
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return formatDateShort(dateStr);
}

const POLL_INTERVAL = 600_000; // 10min safety net — real-time updates via Socket.io

export function NotificationBell() {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [pulse, setPulse] = useState(false);
  const hasFetchedRef = useRef(false);
  const lastDisconnectRef = useRef<number | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications?limit=20');
      if (!res.ok) return;
      const json: NotificationsResponse = await res.json();
      if (json.success) {
        setNotifications(json.data.notifications);
        setUnreadCount(json.data.unreadCount);
        setHasMore(json.data.hasMore);
      }
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unread=true&limit=1');
      if (!res.ok) return;
      const json: NotificationsResponse = await res.json();
      if (json.success) {
        setUnreadCount(json.data.unreadCount);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Fetch full list when popover opens for the first time or re-opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Poll for unread count every 10min (safety net fallback)
  useEffect(() => {
    // Initial count fetch
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchUnreadCount();
    }

    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Listen for real-time notifications via Socket.io
  useEffect(() => {
    if (!socket || !isConnected) return;

    function handleNewNotification(data: {
      id: number;
      type: NotificationType;
      title: string;
      body: string | null;
      link: string | null;
      isRead: boolean;
      createdAt: string;
    }, ack?: (response: { received: boolean }) => void) {
      // Prepend to list (avoid duplicates)
      setNotifications((prev) => {
        if (prev.some((n) => n.id === data.id)) return prev;
        return [data, ...prev];
      });
      setUnreadCount((prev) => prev + 1);

      // Pulse animation on bell
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);

      // Acknowledge receipt to server
      if (typeof ack === 'function') ack({ received: true });
    }

    socket.on('notification:new', handleNewNotification);
    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, isConnected]);

  // Refetch notifications when tab regains focus (catches anything missed while backgrounded)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchUnreadCount]);

  // Reconnect catchup: fetch notifications when socket reconnects after a disconnect
  useEffect(() => {
    if (!socket) return;

    const handleDisconnect = () => {
      lastDisconnectRef.current = Date.now();
    };

    const handleConnect = () => {
      // Only fetch if we previously disconnected (reconnect scenario)
      if (lastDisconnectRef.current !== null) {
        fetchUnreadCount();
        lastDisconnectRef.current = null;
      }
    };

    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);
    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
    };
  }, [socket, fetchUnreadCount]);

  const markAsRead = useCallback(
    async (notification: Notification) => {
      if (!notification.isRead) {
        // Optimistic update
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        try {
          await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: notification.id }),
          });
        } catch {
          // Revert on failure
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, isRead: false } : n))
          );
          setUnreadCount((prev) => prev + 1);
        }
      }

      setOpen(false);
      if (notification.link) {
        router.push(notification.link);
      }
    },
    [router]
  );

  const markAllAsRead = useCallback(async () => {
    setMarkingAllRead(true);
    // Optimistic update
    const previousNotifications = notifications;
    const previousCount = unreadCount;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
    } catch {
      // Revert on failure
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
    } finally {
      setMarkingAllRead(false);
    }
  }, [notifications, unreadCount]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-[44px] min-w-[44px]"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell className={cn('h-5 w-5', pulse && 'animate-pulse text-primary')} />
          {unreadCount > 0 && (
            <span
              aria-live="polite"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0 sm:w-96"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllAsRead}
              disabled={markingAllRead}
            >
              {markingAllRead ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="mr-1 h-3 w-3" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        <Separator />

        {/* Notification List */}
        <div
          className="max-h-80 overflow-y-auto"
          role="list"
          aria-label="Notification list"
        >
          {loading && notifications.length === 0 ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8">
              <Bell className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = NOTIFICATION_ICONS[notification.type];
              return (
                <button
                  key={notification.id}
                  role="listitem"
                  className={cn(
                    'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                    !notification.isRead && 'bg-muted/30'
                  )}
                  onClick={() => markAsRead(notification)}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm',
                        !notification.isRead && 'font-semibold'
                      )}
                    >
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {notification.body}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-burgundy" aria-hidden="true" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        {hasMore && notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setOpen(false);
                  router.push('/dashboard/notifications');
                }}
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
