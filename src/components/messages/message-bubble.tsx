'use client';

import Image from 'next/image';
import { ExternalLink, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateShort, formatTime } from '@/lib/date-utils';
import type {
  MessageWithSender,
  MessageAttachment,
} from '@/app/(dashboard)/dashboard/messages/[id]/actions';
import type { LinkPreviewData } from '@/db/schema';

interface MessageBubbleProps {
  message: MessageWithSender;
  showTimestamp?: boolean;
}

function formatMessageTime(date: Date): string {
  const messageDate = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = messageDate.toDateString() === today.toDateString();
  const isYesterday = messageDate.toDateString() === yesterday.toDateString();

  const time = formatTime(messageDate);

  if (isToday) {
    return time;
  } else if (isYesterday) {
    return `Yesterday ${time}`;
  } else {
    const dateStr = formatDateShort(messageDate);
    return `${dateStr} ${time}`;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(type: string | null): boolean {
  return type?.startsWith('image/') ?? false;
}

// ============================================================================
// ATTACHMENT DISPLAY
// ============================================================================

function AttachmentImage({ attachment, isOwn }: { attachment: MessageAttachment; isOwn: boolean }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 block"
      aria-label={`View full image: ${attachment.name || 'attachment'}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.url}
        alt={attachment.name || 'Image attachment'}
        className={cn(
          'max-w-[300px] rounded-lg object-cover',
          isOwn ? 'border border-primary-foreground/20' : 'border border-border'
        )}
        loading="lazy"
      />
    </a>
  );
}

function AttachmentDocument({
  attachment,
  isOwn,
}: {
  attachment: MessageAttachment;
  isOwn: boolean;
}) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name || undefined}
      className={cn(
        'mt-1 flex items-center gap-3 rounded-lg border p-3 transition-colors',
        isOwn
          ? 'border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/15'
          : 'border-border bg-background hover:bg-accent/50'
      )}
      aria-label={`Download ${attachment.name || 'document'}`}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded',
          isOwn ? 'bg-primary-foreground/20' : 'bg-muted'
        )}
      >
        <FileText
          className={cn('h-5 w-5', isOwn ? 'text-primary-foreground' : 'text-muted-foreground')}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            isOwn ? 'text-primary-foreground' : 'text-foreground'
          )}
        >
          {attachment.name || 'Document'}
        </p>
        {attachment.size && (
          <p
            className={cn(
              'text-xs',
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {formatFileSize(attachment.size)}
          </p>
        )}
      </div>
      <Download
        className={cn(
          'h-4 w-4 shrink-0',
          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )}
      />
    </a>
  );
}

function MessageAttachmentDisplay({
  attachment,
  isOwn,
}: {
  attachment: MessageAttachment;
  isOwn: boolean;
}) {
  if (isImageAttachment(attachment.type)) {
    return <AttachmentImage attachment={attachment} isOwn={isOwn} />;
  }
  return <AttachmentDocument attachment={attachment} isOwn={isOwn} />;
}

// ============================================================================
// LINK PREVIEW CARD
// ============================================================================

function LinkPreviewCard({ preview, isOwn }: { preview: LinkPreviewData; isOwn: boolean }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'mt-2 block overflow-hidden rounded-lg border transition-colors',
        isOwn
          ? 'border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/15'
          : 'border-border bg-background hover:bg-accent/50'
      )}
    >
      {preview.image && (
        <div className="relative h-32 w-full overflow-hidden">
          <Image
            src={preview.image}
            alt={preview.title || 'Link preview'}
            fill
            className="object-cover"
            sizes="300px"
            unoptimized
          />
        </div>
      )}
      <div className="p-2.5">
        {preview.siteName && (
          <div className="flex items-center gap-1">
            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            <span
              className={cn(
                'truncate text-xs font-medium',
                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}
            >
              {preview.siteName}
            </span>
          </div>
        )}
        {preview.title && (
          <p
            className={cn(
              'mt-0.5 line-clamp-2 text-sm font-semibold leading-tight',
              isOwn ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p
            className={cn(
              'mt-0.5 line-clamp-2 text-xs leading-snug',
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MessageBubble({ message, showTimestamp = true }: MessageBubbleProps) {
  const linkPreview = message.metadata?.linkPreview;

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
        {message.content && (
          <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
        )}
        {message.attachment && (
          <MessageAttachmentDisplay attachment={message.attachment} isOwn={message.isOwn} />
        )}
        {linkPreview && <LinkPreviewCard preview={linkPreview} isOwn={message.isOwn} />}
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
