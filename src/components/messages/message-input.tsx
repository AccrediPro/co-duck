'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150); // Max height 150px
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [message, adjustHeight]);

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSend(trimmedMessage);
      setMessage('');
      // Reset textarea height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter, but allow Shift+Enter for new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = message.trim().length > 0 && !isSending && !disabled;

  return (
    <div className="border-t bg-background p-4">
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            rows={1}
            className="flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: '40px', maxHeight: '150px' }}
          />
        </div>
        <Button onClick={handleSend} disabled={!canSend} size="icon" className="h-10 w-10 shrink-0">
          <Send className="h-4 w-4" />
          <span className="sr-only">Send message</span>
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
