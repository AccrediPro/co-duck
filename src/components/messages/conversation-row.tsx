'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ConversationWithDetails } from '@/app/(dashboard)/dashboard/messages/actions';

interface ConversationRowProps {
  conversation: ConversationWithDetails;
  onClick: () => void;
}

// Get initials from name
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Truncate text to specified length
function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

// Format relative timestamp
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
    // Format as date
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

export function ConversationRow({ conversation, onClick }: ConversationRowProps) {
  const hasUnread = conversation.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50',
        hasUnread && 'bg-primary/5'
      )}
    >
      {/* Avatar */}
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={conversation.otherUserAvatar || undefined} />
          <AvatarFallback className="text-sm">
            {getInitials(conversation.otherUserName)}
          </AvatarFallback>
        </Avatar>
        {/* Unread indicator dot */}
        {hasUnread && (
          <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-blue-500" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-sm font-medium', hasUnread && 'font-semibold')}>
            {conversation.otherUserName || 'Unknown User'}
          </span>
          <span className="flex-shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(conversation.lastMessageAt)}
          </span>
        </div>
        <p
          className={cn(
            'mt-1 truncate text-sm',
            hasUnread ? 'font-medium text-foreground' : 'text-muted-foreground'
          )}
        >
          {truncateText(conversation.lastMessageContent, 50) || 'No messages yet'}
        </p>
      </div>
    </button>
  );
}
