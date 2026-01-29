'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Search, MessageSquare } from 'lucide-react';
import { ConversationRow } from './conversation-row';
import { getConversations } from '@/app/(dashboard)/dashboard/messages/actions';
import type { ConversationWithDetails } from '@/app/(dashboard)/dashboard/messages/actions';

interface ConversationsListProps {
  initialConversations: ConversationWithDetails[];
}

export function ConversationsList({ initialConversations }: ConversationsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [conversations, setConversations] = useState(initialConversations);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        const result = await getConversations(searchQuery);
        if (result.success && result.conversations) {
          setConversations(result.conversations);
        }
        setIsSearching(false);
      } else {
        // Reset to initial conversations when search is cleared
        setConversations(initialConversations);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, initialConversations]);

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
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No conversations yet</h3>
        <p className="mt-2 max-w-md text-muted-foreground">
          Your conversations with coaches and clients will appear here. Start a conversation by
          messaging someone from their profile or booking page.
        </p>
      </div>
    );
  }

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

      {/* Results count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          {isSearching ? (
            'Searching...'
          ) : (
            <>
              Found {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </>
          )}
        </p>
      )}

      {/* Conversations list */}
      <div className="space-y-2">
        {conversations.length === 0 && searchQuery ? (
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

      {/* Loading overlay for navigation */}
      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
