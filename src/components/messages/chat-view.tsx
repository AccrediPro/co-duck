'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, Loader2, Info, X, Upload } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import type { MessageInputHandle } from './message-input';
import { ChatContextPanel } from './chat-context-panel';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/hooks/use-toast';
import type {
  ConversationDetails,
  MessageWithSender,
  ClientContext,
} from '@/app/(dashboard)/dashboard/messages/[id]/actions';
import { getMessages, markMessagesAsRead } from '@/app/(dashboard)/dashboard/messages/[id]/actions';

interface ChatViewProps {
  conversation: ConversationDetails;
  initialMessages: MessageWithSender[];
  initialHasMore: boolean;
  clientContext?: ClientContext | null;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function ChatView({
  conversation,
  initialMessages,
  initialHasMore,
  clientContext,
}: ChatViewProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isMobileContextOpen, setIsMobileContextOpen] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const isInitialLoad = useRef(true);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCounterRef = useRef(0);

  const { socket, isConnected } = useSocket();
  const { toast } = useToast();
  const showContextPanel = conversation.isCoach && clientContext;

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      scrollToBottom();
      isInitialLoad.current = false;
    }
  }, [messages, scrollToBottom]);

  // Mark messages as read when conversation is opened
  useEffect(() => {
    markMessagesAsRead(conversation.id);
  }, [conversation.id]);

  // Socket: join/leave room + listen for events
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('conversation:join', { conversationId: conversation.id });
    socket.emit('messages:read', { conversationId: conversation.id });

    const handleNewMessage = (data: {
      id: number;
      content: string;
      messageType: string;
      isRead: boolean;
      createdAt: string;
      conversationId: number;
      senderId: string;
      sender: { id: string; name: string | null; avatarUrl: string | null } | null;
      attachment?: {
        url: string;
        name: string | null;
        type: string | null;
        size: number | null;
      } | null;
    }) => {
      if (data.conversationId !== conversation.id) return;

      const newMsg: MessageWithSender = {
        id: data.id,
        content: data.content,
        messageType: data.messageType as 'text' | 'system',
        senderId: data.senderId,
        senderName: data.sender?.name ?? null,
        senderAvatar: data.sender?.avatarUrl ?? null,
        isOwn: data.senderId === conversation.otherUserId ? false : true,
        isRead: data.isRead,
        createdAt: new Date(data.createdAt),
        attachment: data.attachment ?? null,
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;

        if (newMsg.isOwn) {
          const hasOptimistic = prev.some(
            (m) => m.senderId === 'current-user' && m.content === data.content
          );
          if (hasOptimistic) {
            return prev.map((m) =>
              m.senderId === 'current-user' && m.content === data.content ? newMsg : m
            );
          }
        }

        return [...prev, newMsg];
      });

      if (!newMsg.isOwn) {
        socket.emit('messages:read', { conversationId: conversation.id });
      }

      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom || newMsg.isOwn) {
          setTimeout(() => scrollToBottom('smooth'), 50);
        }
      }
    };

    const handleTypingStart = (data: { userId: string }) => {
      if (data.userId === conversation.otherUserId) {
        setTypingUser(data.userId);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 4000);
      }
    };

    const handleTypingStop = (data: { userId: string }) => {
      if (data.userId === conversation.otherUserId) {
        setTypingUser(null);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
    };

    const handlePresenceUpdate = (data: { userId: string; status: string }) => {
      if (data.userId === conversation.otherUserId) {
        setOtherUserOnline(data.status === 'online');
      }
    };

    const handleMessagesRead = (data: { conversationId: number; readBy: string }) => {
      if (data.conversationId !== conversation.id) return;
      if (data.readBy === conversation.otherUserId) {
        setMessages((prev) => prev.map((m) => (m.isOwn && !m.isRead ? { ...m, isRead: true } : m)));
      }
    };

    const handleMessageUpdated = (data: {
      id: number;
      conversationId: number;
      metadata: MessageWithSender['metadata'];
    }) => {
      if (data.conversationId !== conversation.id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === data.id ? { ...m, metadata: data.metadata } : m))
      );
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('messages:read', handleMessagesRead);
    socket.on('message:updated', handleMessageUpdated);

    return () => {
      socket.emit('conversation:leave', { conversationId: conversation.id });
      socket.off('message:new', handleNewMessage);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('messages:read', handleMessagesRead);
      socket.off('message:updated', handleMessageUpdated);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, isConnected, conversation.id, conversation.otherUserId, scrollToBottom]);

  // Load older messages when scrolling to top
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;

    setIsLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      const result = await getMessages(conversation.id, 50, oldestMessage.id);

      if (result.success && result.messages) {
        setMessages((prev) => [...result.messages!, ...prev]);
        setHasMore(result.hasMore || false);

        const container = messagesContainerRef.current;
        if (container) {
          const previousScrollHeight = container.scrollHeight;
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight - previousScrollHeight;
          });
        }
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversation.id, hasMore, isLoadingMore, messages]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (container.scrollTop < 100 && hasMore && !isLoadingMore) {
      loadMoreMessages();
    }
  }, [hasMore, isLoadingMore, loadMoreMessages]);

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && messageInputRef.current) {
      messageInputRef.current.attachFile(file);
    }
  }, []);

  // Send message via API (supports text + optional file via FormData)
  const handleSend = async (content: string, file?: File) => {
    setSendError(null);

    const tempId = Date.now();
    const hasFile = !!file;

    const optimisticMessage: MessageWithSender = {
      id: tempId,
      content,
      messageType: 'text',
      senderId: 'current-user',
      senderName: 'You',
      senderAvatar: null,
      isOwn: true,
      isRead: false,
      createdAt: new Date(),
      attachment: hasFile ? { url: '', name: file.name, type: file.type, size: file.size } : null,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    if (hasFile) {
      // File upload — must use API route with FormData (socket doesn't support files)
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (content) {
          formData.append('content', content);
        }

        const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
          method: 'POST',
          body: formData,
        });

        const result = await res.json();

        if (result.success && result.data) {
          const serverMsg: MessageWithSender = {
            id: result.data.id,
            content: result.data.content,
            messageType: result.data.messageType,
            senderId: result.data.sender?.id ?? 'current-user',
            senderName: result.data.sender?.name ?? 'You',
            senderAvatar: result.data.sender?.avatarUrl ?? null,
            isOwn: true,
            isRead: result.data.isRead,
            createdAt: new Date(result.data.createdAt),
            attachment: result.data.attachment ?? null,
            metadata: result.data.metadata ?? null,
          };

          setMessages((prev) => prev.map((msg) => (msg.id === tempId ? serverMsg : msg)));
        } else {
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
          const errMsg = result.error?.message || result.error || 'Failed to send message';
          setSendError(errMsg);
          toast({
            title: 'Upload failed',
            description: errMsg,
            variant: 'destructive',
          });
        }
      } catch {
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        setSendError('Failed to upload file. Please try again.');
        toast({
          title: 'Upload failed',
          description: 'Could not upload the file. Please try again.',
          variant: 'destructive',
        });
      }
    } else if (socket?.connected) {
      // Text-only via socket
      socket.emit('message:send', {
        conversationId: conversation.id,
        content,
      });

      const sendTimeout = setTimeout(() => {
        setMessages((prev) => {
          const stillOptimistic = prev.some(
            (m) => m.id === tempId && m.senderId === 'current-user'
          );
          if (stillOptimistic) {
            setSendError('Message may not have been sent. Please try again.');
          }
          return prev;
        });
      }, 10000);

      const cleanup = (data: { content: string }) => {
        if (data.content === content) {
          clearTimeout(sendTimeout);
          socket.off('message:new', cleanup);
        }
      };
      socket.on('message:new', cleanup);
    } else {
      // Fallback: use server action if socket is disconnected
      const { sendMessage } = await import('@/app/(dashboard)/dashboard/messages/[id]/actions');
      const result = await sendMessage(conversation.id, content);

      if (result.success && result.message) {
        setMessages((prev) => prev.map((msg) => (msg.id === tempId ? result.message! : msg)));
      } else {
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        setSendError(result.error || 'Failed to send message');
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      {/* Main Chat Area */}
      <div
        className="relative flex flex-1 flex-col overflow-hidden rounded-lg border bg-background"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary p-10">
              <Upload className="h-10 w-10 text-primary" />
              <p className="text-lg font-medium text-primary">Drop file to attach</p>
              <p className="text-sm text-muted-foreground">Images, PDFs, and documents up to 5MB</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/dashboard/messages">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to messages</span>
            </Link>
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarImage src={conversation.otherUserAvatar || undefined} />
            <AvatarFallback>{getInitials(conversation.otherUserName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-semibold">{conversation.otherUserName || 'User'}</h1>
              {otherUserOnline && (
                <span
                  className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--brand-accent))]"
                  title="Online"
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {otherUserOnline ? 'Online' : conversation.isCoach ? 'Client' : 'Coach'}
            </p>
          </div>
          {showContextPanel && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setIsMobileContextOpen(true)}
            >
              <Info className="h-5 w-5" />
              <span className="sr-only">View client info</span>
            </Button>
          )}
        </div>

        {/* Messages area */}
        <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {hasMore && !isLoadingMore && (
            <div className="flex justify-center py-4">
              <Button variant="ghost" size="sm" onClick={loadMoreMessages}>
                Load older messages
              </Button>
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <p className="text-muted-foreground">No messages yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Send a message to start the conversation
              </p>
            </div>
          )}

          <div className="py-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} showTimestamp />
            ))}
          </div>

          {/* Typing indicator */}
          {typingUser && (
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                </span>
                <span>{conversation.otherUserName || 'User'} is typing...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {sendError && (
          <div className="border-t bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
            {sendError}
          </div>
        )}

        <MessageInput
          ref={messageInputRef}
          onSend={handleSend}
          placeholder={`Message ${conversation.otherUserName || 'user'}...`}
          conversationId={conversation.id}
        />
      </div>

      {/* Desktop Context Panel */}
      {showContextPanel && (
        <div className="hidden w-80 lg:block">
          <ChatContextPanel context={clientContext} />
        </div>
      )}

      {/* Mobile Context Panel Sheet */}
      {showContextPanel && (
        <Sheet open={isMobileContextOpen} onOpenChange={setIsMobileContextOpen}>
          <SheetContent side="right" className="w-full p-0 sm:max-w-md">
            <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
              <SheetTitle>Client Info</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileContextOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </SheetHeader>
            <ChatContextPanel context={clientContext} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
