/**
 * @fileoverview Individual message bubble component.
 *
 * Renders a single message with appropriate styling based on sender and type.
 * Supports both regular text messages and system messages (automated notifications).
 *
 * ## Visual Styles
 *
 * - Own messages: Right-aligned, primary color background
 * - Other's messages: Left-aligned, muted background
 * - System messages: Centered, subtle muted background
 *
 * @module components/messages/message-bubble
 */

'use client';

import { cn } from '@/lib/utils';
import type { MessageWithSender } from '@/app/(dashboard)/dashboard/messages/[id]/actions';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props for the MessageBubble component.
 *
 * @property message - The message data with sender info
 * @property showTimestamp - Whether to display the timestamp (default: true)
 */
interface MessageBubbleProps {
  message: MessageWithSender;
  showTimestamp?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a message timestamp for display.
 *
 * Shows relative time for recent messages:
 * - Today: "2:30 PM"
 * - Yesterday: "Yesterday 2:30 PM"
 * - Older: "Jan 15 2:30 PM"
 *
 * @param date - Message creation timestamp
 * @returns Formatted time string
 */
function formatMessageTime(date: Date): string {
  const messageDate = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = messageDate.toDateString() === today.toDateString();
  const isYesterday = messageDate.toDateString() === yesterday.toDateString();

  const time = messageDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return time;
  } else if (isYesterday) {
    return `Yesterday ${time}`;
  } else {
    const dateStr = messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${dateStr} ${time}`;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Renders a single message in the chat view.
 *
 * Handles two distinct display modes:
 * - System messages: Centered, muted styling for automated notifications
 * - User messages: Aligned based on sender, with speech bubble styling
 *
 * @param props - Component props
 * @returns Message bubble JSX
 *
 * @example
 * // In ChatView message list
 * {messages.map(message => (
 *   <MessageBubble key={message.id} message={message} showTimestamp />
 * ))}
 */
export function MessageBubble({ message, showTimestamp = true }: MessageBubbleProps) {
  // System messages are centered with different styling
  if (message.messageType === 'system') {
    return (
      <div className="flex justify-center px-4 py-2">
        <div className="max-w-md rounded-lg bg-muted/50 px-4 py-2 text-center">
          <p className="text-sm text-muted-foreground">{message.content}</p>
          {showTimestamp && (
            <span className="mt-1 block text-xs text-muted-foreground/70">
              {formatMessageTime(message.createdAt)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex w-full px-4 py-1', message.isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-2',
          message.isOwn
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md bg-muted'
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
        {showTimestamp && (
          <span
            className={cn(
              'mt-1 block text-xs',
              message.isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
            )}
          >
            {formatMessageTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
