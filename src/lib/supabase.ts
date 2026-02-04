import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Client for Realtime Subscriptions
 *
 * This client is used for real-time features (messaging, notifications).
 * Database queries still use Drizzle ORM (src/db/index.ts).
 *
 * @remarks
 * - Use this client for WebSocket subscriptions to database changes
 * - Do NOT use this for regular CRUD operations (use Drizzle instead)
 * - Works with both web and mobile apps
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase Realtime not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for real-time features.'
  );
}

/**
 * Supabase client for realtime subscriptions
 *
 * @example
 * // Subscribe to new messages in a conversation
 * const channel = supabase
 *   .channel('messages:123')
 *   .on('postgres_changes', {
 *     event: 'INSERT',
 *     schema: 'public',
 *     table: 'messages',
 *     filter: 'conversation_id=eq.123'
 *   }, (payload) => {
 *     console.log('New message:', payload.new);
 *   })
 *   .subscribe();
 *
 * // Cleanup when done
 * supabase.removeChannel(channel);
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : null;

/**
 * Check if Supabase Realtime is available
 */
export const isRealtimeAvailable = (): boolean => {
  return supabase !== null;
};

/**
 * Subscribe to new messages in a conversation
 *
 * @param conversationId - The conversation ID to subscribe to
 * @param onMessage - Callback when a new message arrives
 * @returns Cleanup function to unsubscribe
 *
 * @example
 * const unsubscribe = subscribeToMessages(123, (message) => {
 *   console.log('New message:', message);
 * });
 *
 * // Later, cleanup
 * unsubscribe();
 */
export const subscribeToMessages = (
  conversationId: number,
  onMessage: (message: {
    id: number;
    conversation_id: number;
    sender_id: string;
    content: string;
    message_type: 'text' | 'system';
    is_read: boolean;
    created_at: string;
  }) => void
): (() => void) => {
  if (!supabase) {
    console.warn('Supabase not configured, falling back to polling');
    return () => {};
  }

  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onMessage(payload.new as Parameters<typeof onMessage>[0]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Subscribe to conversation updates (new messages, read status)
 *
 * @param userId - The user ID to get conversations for
 * @param onUpdate - Callback when a conversation is updated
 * @returns Cleanup function to unsubscribe
 */
export const subscribeToConversations = (
  userId: string,
  onUpdate: (conversation: {
    id: number;
    coach_id: string;
    client_id: string;
    last_message_at: string | null;
  }) => void
): (() => void) => {
  if (!supabase) {
    console.warn('Supabase not configured, falling back to polling');
    return () => {};
  }

  // Subscribe to conversations where user is coach or client
  const channel = supabase
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `coach_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new as Parameters<typeof onUpdate>[0]);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `client_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new as Parameters<typeof onUpdate>[0]);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Subscribe to booking updates for a user
 *
 * @param userId - The user ID (coach or client)
 * @param onUpdate - Callback when a booking is created/updated
 * @returns Cleanup function to unsubscribe
 */
export const subscribeToBookings = (
  userId: string,
  onUpdate: (booking: {
    id: number;
    coach_id: string;
    client_id: string;
    status: string;
    start_time: string;
  }) => void
): (() => void) => {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel(`bookings:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `coach_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new as Parameters<typeof onUpdate>[0]);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `client_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new as Parameters<typeof onUpdate>[0]);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
