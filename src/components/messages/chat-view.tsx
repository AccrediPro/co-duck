'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeft, Loader2, Info, X } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { ChatContextPanel } from './chat-context-panel';
import type {
  ConversationDetails,
  MessageWithSender,
  ClientContext,
} from '@/app/(dashboard)/dashboard/messages/[id]/actions';
import {
  getMessages,
  markMessagesAsRead,
  sendMessage,
  getNewMessages,
} from '@/app/(dashboard)/dashboard/messages/[id]/actions';

interface ChatViewProps {
  conversation: ConversationDetails;
  initialMessages: MessageWithSender[];
  initialHasMore: boolean;
  clientContext?: ClientContext | null;
}

// Get initials from name
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Check if user is a coach and has context data
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

  // Load older messages when scrolling to top
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;

    setIsLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      const result = await getMessages(conversation.id, 50, oldestMessage.id);

      if (result.success && result.messages) {
        // Prepend older messages
        setMessages((prev) => [...result.messages!, ...prev]);
        setHasMore(result.hasMore || false);

        // Maintain scroll position
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

  // Handle scroll for infinite scroll (load more when at top)
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Load more when scrolled near the top
    if (container.scrollTop < 100 && hasMore && !isLoadingMore) {
      loadMoreMessages();
    }
  }, [hasMore, isLoadingMore, loadMoreMessages]);

  // Handle sending a message with optimistic UI update
  const handleSend = async (content: string) => {
    setSendError(null);

    // Generate a temporary ID for optimistic update
    const tempId = Date.now();

    // Create optimistic message
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
    };

    // Add optimistic message to the list
    setMessages((prev) => [...prev, optimisticMessage]);

    // Scroll to show new message
    setTimeout(() => scrollToBottom('smooth'), 50);

    // Send the message to the server
    const result = await sendMessage(conversation.id, content);

    if (result.success && result.message) {
      // Replace optimistic message with real message from server
      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? result.message! : msg)));
    } else {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setSendError(result.error || 'Failed to send message');
    }
  };

  // Poll for new messages every 3 seconds
  useEffect(() => {
    // Only poll if we have messages (to get the last message ID)
    // and the component is mounted
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const pollForNewMessages = async () => {
      // Get the highest message ID from current messages
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) return;

      // Skip if it's an optimistic message (non-numeric or very large temporary ID)
      if (lastMessage.senderId === 'current-user') return;

      try {
        const result = await getNewMessages(conversation.id, lastMessage.id);

        if (result.success && result.messages && result.messages.length > 0) {
          // Filter out any messages we already have (including optimistic ones)
          const existingIds = new Set(messages.map((m) => m.id));
          const newMessages = result.messages.filter((m) => !existingIds.has(m.id));

          if (newMessages.length > 0) {
            setMessages((prev) => [...prev, ...newMessages]);

            // Mark new messages from others as read
            markMessagesAsRead(conversation.id);

            // Scroll to bottom if user is near the bottom
            const container = messagesContainerRef.current;
            if (container) {
              const isNearBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight < 100;
              if (isNearBottom) {
                setTimeout(() => scrollToBottom('smooth'), 50);
              }
            }
          }
        }
      } catch (error) {
        // Silently handle polling errors - don't disrupt the UI
        console.error('Error polling for new messages:', error);
      }
    };

    // Start polling
    pollInterval = setInterval(pollForNewMessages, 3000);

    // Cleanup on unmount or when conversation changes
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [conversation.id, messages, scrollToBottom]);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-background">
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
            <h1 className="truncate font-semibold">{conversation.otherUserName || 'User'}</h1>
            <p className="text-sm text-muted-foreground">
              {conversation.isCoach ? 'Client' : 'Coach'}
            </p>
          </div>
          {/* Mobile context panel toggle - only for coaches */}
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
          {/* Loading indicator for older messages */}
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* "Load more" button when there are more messages */}
          {hasMore && !isLoadingMore && (
            <div className="flex justify-center py-4">
              <Button variant="ghost" size="sm" onClick={loadMoreMessages}>
                Load older messages
              </Button>
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <p className="text-muted-foreground">No messages yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Send a message to start the conversation
              </p>
            </div>
          )}

          {/* Messages list */}
          <div className="py-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} showTimestamp />
            ))}
          </div>

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Error message */}
        {sendError && (
          <div className="border-t bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
            {sendError}
          </div>
        )}

        {/* Message input */}
        <MessageInput
          onSend={handleSend}
          placeholder={`Message ${conversation.otherUserName || 'user'}...`}
        />
      </div>

      {/* Desktop Context Panel - only for coaches */}
      {showContextPanel && (
        <div className="hidden w-80 lg:block">
          <ChatContextPanel context={clientContext} />
        </div>
      )}

      {/* Mobile Context Panel Sheet - only for coaches */}
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
