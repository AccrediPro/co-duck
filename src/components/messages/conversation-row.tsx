/**
 * @fileoverview Individual conversation row for the inbox list.
 *
 * Renders a clickable conversation preview showing the other user's info,
 * last message snippet, timestamp, and unread indicator.
 *
 * ## Visual Features
 *
 * - Avatar with fallback initials
 * - Blue dot indicator for unread messages
 * - Relative timestamp (e.g., "2h ago", "Yesterday")
 * - Message preview truncated to 50 characters
 * - Highlighted styling for conversations with unread messages
 *
 * @module components/messages/conversation-row
 */

'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDateShort } from '@/lib/date-utils';
import type { ConversationWithDetails } from '@/app/(dashboard)/dashboard/messages/actions';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props for the ConversationRow component.
 *
 * @property conversation - Conversation data with other user info
 * @property onClick - Handler called when the row is clicked
 */
interface ConversationRowProps {
  conversation: ConversationWithDetails;
  onClick: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract initials from a user's name for avatar fallback.
 *
 * @param name - Full name (e.g., "John Doe")
 * @returns Initials (e.g., "JD") or "?" if name is null/empty
 */
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Truncate text to a maximum length with ellipsis.
 *
 * @param text - Text to truncate (may be null)
 * @param maxLength - Maximum character count
 * @returns Truncated text with "..." if exceeded, or original/empty string
 */
function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Format a timestamp as relative time for conversation list display.
 *
 * Time ranges:
 * - < 1 minute: "Just now"
 * - < 1 hour: "Xm ago"
 * - < 24 hours: "Xh ago"
 * - Yesterday: "Yesterday"
 * - < 7 days: "Xd ago"
 * - < 4 weeks: "Xw ago"
 * - Older: "Jan 15" (month + day)
 *
 * @param date - Timestamp to format (may be null)
 * @returns Formatted relative time string, or empty string if null
 */
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
    return formatDateShort(new Date(date));
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Clickable row showing a conversation preview in the inbox list.
 *
 * Displays the other participant's avatar, name, last message preview,
 * relative timestamp, and unread indicator.
 *
 * @param props - Component props
 * @returns Conversation row button JSX
 *
 * @example
 * // In ConversationsList
 * {conversations.map(conv => (
 *   <ConversationRow
 *     key={conv.id}
 *     conversation={conv}
 *     onClick={() => navigateToChat(conv.id)}
 *   />
 * ))}
 */
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
          <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-[hsl(var(--brand-accent))]" />
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
