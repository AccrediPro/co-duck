'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, MessageSquare, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationRow } from './conversation-row';
import { useSocket } from '@/hooks/useSocket';
import { getConversations } from '@/app/(dashboard)/dashboard/messages/actions';
import type { ConversationWithDetails } from '@/app/(dashboard)/dashboard/messages/actions';

type SearchMode = 'conversations' | 'messages';

interface MessageSearchResult {
  conversationId: number;
  messageId: number;
  content: string;
  senderId: string;
  senderName: string | null;
  createdAt: string;
  otherUser: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface ConversationsListProps {
  initialConversations: ConversationWithDetails[];
  userRole: 'coach' | 'client' | 'admin';
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;

  // Show context around the match
  const contextChars = 40;
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  const snippet = text.slice(start, end);
  const matchStart = idx - start;

  return (
    <span>
      {prefix}
      {snippet.slice(0, matchStart)}
      <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-800">
        {snippet.slice(matchStart, matchStart + query.length)}
      </mark>
      {snippet.slice(matchStart + query.length)}
      {suffix}
    </span>
  );
}

export function ConversationsList({ initialConversations, userRole }: ConversationsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [conversations, setConversations] = useState(initialConversations);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('conversations');
  const [isSearching, setIsSearching] = useState(false);
  const [messageResults, setMessageResults] = useState<MessageSearchResult[]>([]);
  const { socket, isConnected } = useSocket();

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setConversations(initialConversations);
      setMessageResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);

      if (searchMode === 'conversations') {
        const result = await getConversations(searchQuery);
        if (result.success && result.conversations) {
          setConversations(result.conversations);
        }
        setMessageResults([]);
      } else {
        // Message content search — needs 3+ characters
        if (searchQuery.trim().length >= 3) {
          try {
            const res = await fetch(
              `/api/conversations/search?q=${encodeURIComponent(searchQuery.trim())}&limit=20`
            );
            const data = await res.json();
            if (data.success) {
              setMessageResults(data.data.results);
            } else {
              setMessageResults([]);
            }
          } catch {
            setMessageResults([]);
          }
        } else {
          setMessageResults([]);
        }
        // Also filter conversations by name in message mode for context
        const result = await getConversations(searchQuery);
        if (result.success && result.conversations) {
          setConversations(result.conversations);
        }
      }

      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode, initialConversations]);

  // Listen for real-time conversation updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleConversationUpdated = (data: {
      conversationId: number;
      lastMessageAt: string;
      lastMessageContent: string;
      lastMessageSenderId: string;
    }) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === data.conversationId);
        if (idx === -1) return prev;

        const updated = [...prev];
        const conv = { ...updated[idx] };
        conv.lastMessageContent = data.lastMessageContent;
        conv.lastMessageAt = new Date(data.lastMessageAt);

        if (data.lastMessageSenderId === conv.otherUserId) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }

        updated[idx] = conv;
        updated.sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });

        return updated;
      });
    };

    const handleMessagesRead = (data: { conversationId: number; readBy: string }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === data.conversationId && data.readBy !== c.otherUserId) {
            return { ...c, unreadCount: 0 };
          }
          return c;
        })
      );
    };

    const handlePresenceUpdate = (data: { userId: string; status: string }) => {
      void data;
    };

    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('messages:read', handleMessagesRead);
    socket.on('presence:update', handlePresenceUpdate);

    return () => {
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('messages:read', handleMessagesRead);
      socket.off('presence:update', handlePresenceUpdate);
    };
  }, [socket, isConnected]);

  const handleConversationClick = useCallback(
    (conversationId: number) => {
      startTransition(() => {
        router.push(`/dashboard/messages/${conversationId}`);
      });
    },
    [router]
  );

  // Empty state
  if (initialConversations.length === 0 && !searchQuery) {
    const isClient = userRole === 'client';
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No conversations yet</h3>
        <p className="mt-2 max-w-md text-muted-foreground">
          {isClient
            ? 'Book a session with a coach to start chatting.'
            : 'Your conversations with clients will appear here.'}
        </p>
        {isClient && (
          <Button asChild className="mt-6">
            <Link href="/coaches">Browse Coaches</Link>
          </Button>
        )}
      </div>
    );
  }

  const hasQuery = searchQuery.trim().length > 0;
  const noConversationResults = hasQuery && conversations.length === 0;
  const noMessageResults = hasQuery && searchQuery.trim().length >= 3 && messageResults.length === 0;
  const showMessageResults = searchMode === 'messages' && searchQuery.trim().length >= 3;

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={
            searchMode === 'conversations' ? 'Search by name...' : 'Search message content...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Search mode toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setSearchMode('conversations')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            searchMode === 'conversations'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Conversations
        </button>
        <button
          onClick={() => setSearchMode('messages')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            searchMode === 'messages'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Messages
        </button>
      </div>

      {/* Loading indicator */}
      {isSearching && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching...
        </div>
      )}

      {/* Search status */}
      {hasQuery && !isSearching && searchMode === 'conversations' && (
        <p className="text-sm text-muted-foreground">
          Found {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} matching
          &quot;{searchQuery}&quot;
        </p>
      )}

      {/* Conversations mode: conversation results */}
      {searchMode === 'conversations' && (
        <div className="space-y-2">
          {noConversationResults ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                No conversations found matching &ldquo;{searchQuery}&rdquo;
              </p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                onClick={() => handleConversationClick(conversation.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Messages mode */}
      {searchMode === 'messages' && (
        <div className="space-y-4">
          {/* Hint for minimum characters */}
          {hasQuery && searchQuery.trim().length < 3 && !isSearching && (
            <p className="text-sm text-muted-foreground">
              Type at least 3 characters to search messages
            </p>
          )}

          {/* Message search results */}
          {showMessageResults && !isSearching && (
            <>
              <p className="text-sm text-muted-foreground">
                Found {messageResults.length} message{messageResults.length !== 1 ? 's' : ''}{' '}
                matching &quot;{searchQuery}&quot;
              </p>

              {noMessageResults ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No messages found matching &ldquo;{searchQuery}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messageResults.map((result) => (
                    <button
                      key={result.messageId}
                      onClick={() => handleConversationClick(result.conversationId)}
                      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={result.otherUser.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(result.otherUser.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {result.otherUser.name || 'Unknown User'}
                          </span>
                          <span className="flex-shrink-0 text-xs text-muted-foreground">
                            {formatRelativeTime(result.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {result.senderName || 'Unknown'}:
                        </p>
                        <p className="mt-0.5 text-sm text-foreground">
                          {highlightMatch(result.content, searchQuery)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
