'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useTransition } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateShort } from '@/lib/date-utils';
import { useSocket } from '@/hooks/useSocket';
import type { FeedPost } from './feed-view';

export interface IConnectContact {
  conversationId: number;
  otherUserId: string;
  otherUserName: string | null;
  otherUserAvatar: string | null;
  otherUserRole: 'coach' | 'client' | 'admin';
  lastPostContent: string | null;
  lastPostAt: Date | null;
  unreadCount: number;
}

interface ContactListProps {
  contacts: IConnectContact[];
  userRole: 'coach' | 'client' | 'admin';
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return '';

  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  } else {
    return formatDateShort(new Date(date));
  }
}

export function ContactList({ contacts: initialContacts, userRole }: ContactListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<IConnectContact[]>(initialContacts);
  const { socket } = useSocket();

  // Sync with server-rendered contacts on navigation
  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  // Socket.io: listen for new iConnect posts to update unread counts and reorder
  useEffect(() => {
    if (!socket) return;

    const handleNewPost = (data: { conversationId: number; post: FeedPost }) => {
      setContacts((prev) => {
        const updated = prev.map((c) => {
          if (c.conversationId !== data.conversationId) return c;
          return {
            ...c,
            unreadCount: c.unreadCount + 1,
            lastPostContent:
              data.post.type === 'task'
                ? 'New task checklist'
                : data.post.content || 'New post',
            lastPostAt: new Date(data.post.createdAt),
          };
        });
        // Bump the updated conversation to the top
        return updated.sort((a, b) => {
          const aTime = a.lastPostAt ? new Date(a.lastPostAt).getTime() : 0;
          const bTime = b.lastPostAt ? new Date(b.lastPostAt).getTime() : 0;
          return bTime - aTime;
        });
      });
    };

    socket.on('iconnect:new_post', handleNewPost);
    return () => {
      socket.off('iconnect:new_post', handleNewPost);
    };
  }, [socket]);

  if (contacts.length === 0) {
    const isClient = userRole === 'client';
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <LayoutList className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No connections yet</h3>
        <p className="mt-2 max-w-md text-muted-foreground">
          {isClient
            ? 'Book a session with a coach to start using iConnect.'
            : 'Your iConnect connections with clients will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contacts.map((contact) => {
        const hasUnread = contact.unreadCount > 0;
        const roleLabel = contact.otherUserRole === 'coach' ? 'Coach' : 'Client';

        return (
          <button
            key={contact.conversationId}
            onClick={() => {
              startTransition(() => {
                router.push(`/dashboard/iconnect/${contact.conversationId}`);
              });
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3 sm:p-4 text-left transition-colors hover:bg-muted/50 min-h-[72px]',
              hasUnread && 'bg-primary/5'
            )}
          >
            <div className="relative shrink-0">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                <AvatarImage src={contact.otherUserAvatar || undefined} />
                <AvatarFallback className="text-sm">
                  {getInitials(contact.otherUserName)}
                </AvatarFallback>
              </Avatar>
              {hasUnread && (
                <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-[hsl(var(--brand-accent))]" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className={cn('truncate text-sm font-medium', hasUnread && 'font-semibold')}>
                    {contact.otherUserName || 'Unknown User'}
                  </span>
                  <Badge variant="secondary" className="flex-shrink-0 text-[10px] px-1.5 py-0">
                    {roleLabel}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {hasUnread && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(var(--brand-accent))] px-1.5 text-xs font-medium text-white">
                      {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(contact.lastPostAt)}
                  </span>
                </div>
              </div>
              <p
                className={cn(
                  'mt-0.5 truncate text-xs sm:text-sm',
                  hasUnread ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {truncateText(contact.lastPostContent, 60) || 'No posts yet'}
              </p>
            </div>
          </button>
        );
      })}

      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
