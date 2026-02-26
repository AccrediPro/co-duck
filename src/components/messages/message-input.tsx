'use client';

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, X, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSocket } from '@/lib/socket';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith('image/');
}

interface MessageInputProps {
  onSend: (content: string, file?: File) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  conversationId?: number;
}

export interface MessageInputHandle {
  attachFile: (file: File) => void;
}

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(
  function MessageInput(
    { onSend, disabled = false, placeholder = 'Type a message...', conversationId },
    ref
  ) {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingRef = useRef(false);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { toast } = useToast();

    useImperativeHandle(ref, () => ({
      attachFile: (file: File) => {
        handleFileSelected(file);
      },
    }));

    // Clean up preview URL on unmount or file change
    useEffect(() => {
      return () => {
        if (filePreviewUrl) {
          URL.revokeObjectURL(filePreviewUrl);
        }
      };
    }, [filePreviewUrl]);

    // Auto-resize textarea
    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 150);
        textarea.style.height = `${newHeight}px`;
      }
    }, []);

    useEffect(() => {
      adjustHeight();
    }, [message, adjustHeight]);

    // Cleanup typing timer on unmount
    useEffect(() => {
      return () => {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        if (typingRef.current && conversationId) {
          const socket = getSocket();
          socket?.emit('typing:stop', { conversationId });
        }
      };
    }, [conversationId]);

    const emitTypingStart = useCallback(() => {
      if (!conversationId) return;
      const socket = getSocket();
      if (!socket?.connected) return;

      if (!typingRef.current) {
        typingRef.current = true;
        socket.emit('typing:start', { conversationId });
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        typingRef.current = false;
        socket.emit('typing:stop', { conversationId });
      }, 3000);
    }, [conversationId]);

    const emitTypingStop = useCallback(() => {
      if (!conversationId) return;
      const socket = getSocket();
      if (!socket?.connected) return;

      if (typingRef.current) {
        typingRef.current = false;
        socket.emit('typing:stop', { conversationId });
        if (typingTimerRef.current) {
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = null;
        }
      }
    }, [conversationId]);

    const handleFileSelected = useCallback(
      (file: File) => {
        if (file.size > MAX_FILE_SIZE) {
          toast({
            title: 'File too large',
            description: 'Maximum file size is 5MB',
            variant: 'destructive',
          });
          return;
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx'];
        if (!validExtensions.includes(ext)) {
          toast({
            title: 'Invalid file type',
            description: 'Allowed: JPEG, PNG, WebP, GIF, PDF, DOC, DOCX',
            variant: 'destructive',
          });
          return;
        }

        // Revoke old preview
        if (filePreviewUrl) {
          URL.revokeObjectURL(filePreviewUrl);
        }

        setSelectedFile(file);
        if (isImageType(file.type)) {
          setFilePreviewUrl(URL.createObjectURL(file));
        } else {
          setFilePreviewUrl(null);
        }
      },
      [filePreviewUrl, toast]
    );

    const clearFile = useCallback(() => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
      setSelectedFile(null);
      setFilePreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }, [filePreviewUrl]);

    const handleSend = async () => {
      const trimmedMessage = message.trim();
      if ((!trimmedMessage && !selectedFile) || isSending || disabled) return;

      emitTypingStop();

      setIsSending(true);
      try {
        await onSend(trimmedMessage, selectedFile || undefined);
        setMessage('');
        clearFile();
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } finally {
        setIsSending(false);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);
      if (e.target.value.trim()) {
        emitTypingStart();
      } else {
        emitTypingStop();
      }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelected(file);
      }
    };

    const canSend = (message.trim().length > 0 || selectedFile !== null) && !isSending && !disabled;

    return (
      <div className="border-t bg-background p-4">
        {/* File preview bar */}
        {selectedFile && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border bg-muted/50 p-2">
            {filePreviewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={filePreviewUrl}
                alt={selectedFile.name}
                className="h-12 w-12 rounded object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={clearFile}
              aria-label="Remove attachment"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isSending}
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileInputChange}
            className="hidden"
            aria-hidden="true"
          />

          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isSending}
              rows={1}
              className="flex w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              style={{ minHeight: '40px', maxHeight: '150px' }}
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={!canSend}
            size="icon"
            className="h-10 w-10 shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    );
  }
);
