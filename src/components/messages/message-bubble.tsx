'use client';

import { cn } from '@/lib/utils';
import type { MessageWithSender } from '@/app/(dashboard)/dashboard/messages/[id]/actions';

interface MessageBubbleProps {
  message: MessageWithSender;
  showTimestamp?: boolean;
}

// Format timestamp for messages
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
