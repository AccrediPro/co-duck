'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MessageSquare, Loader2 } from 'lucide-react';
import { ConversationRow } from './conversation-row';
import { useSocket } from '@/hooks/useSocket';
import { getConversations } from '@/app/(dashboard)/dashboard/messages/actions';
import type { ConversationWithDetails } from '@/app/(dashboard)/dashboard/messages/actions';

interface ConversationsListProps {
  initialConversations: ConversationWithDetails[];
  userRole: 'coach' | 'client' | 'admin';
}

export function ConversationsList({ initialConversations, userRole }: ConversationsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [conversations, setConversations] = useState(initialConversations);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { socket, isConnected } = useSocket();

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setConversations(initialConversations);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);

      const result = await getConversations(searchQuery);
      if (result.success && result.conversations) {
        setConversations(result.conversations);
      }

      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, initialConversations]);

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

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading indicator */}
      {isSearching && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching...
        </div>
      )}

      {/* Search status */}
      {hasQuery && !isSearching && (
        <p className="text-sm text-muted-foreground">
          Found {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} matching
          &quot;{searchQuery}&quot;
        </p>
      )}

      {/* Conversation results */}
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

      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
