'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import type {
  ConversationDetails,
  MessageWithSender,
} from '@/app/(dashboard)/dashboard/messages/[id]/actions';
import { getMessages, markMessagesAsRead } from '@/app/(dashboard)/dashboard/messages/[id]/actions';

interface ChatViewProps {
  conversation: ConversationDetails;
  initialMessages: MessageWithSender[];
  initialHasMore: boolean;
}

// Get initials from name
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function ChatView({ conversation, initialMessages, initialHasMore }: ChatViewProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

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

  // Temporary send handler (will be replaced in COACH-039 with real implementation)
  const handleSend = async (content: string) => {
    setSendError(null);

    // Create optimistic message
    const optimisticMessage: MessageWithSender = {
      id: Date.now(), // Temporary ID
      content,
      messageType: 'text',
      senderId: 'current-user', // Will be replaced
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

    // Note: Actual sending will be implemented in COACH-039
    // For now, just show the message locally
    // When COACH-039 is implemented, replace this with actual sendMessage call
    // and handle errors/replace optimistic message with real one
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border bg-background">
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
  );
}
