/**
 * @fileoverview Server actions for the individual chat view page.
 *
 * This module provides all functionality for the real-time chat interface,
 * including message loading, sending, read status, and coach context panel.
 *
 * ## Features
 *
 * - Load conversation details (header info)
 * - Paginated message history with infinite scroll
 * - Send new messages with optimistic UI support
 * - Poll for new messages (3-second interval)
 * - Mark messages as read
 * - Client context panel for coaches (stats, upcoming sessions, action items)
 *
 * ## Pagination
 *
 * Messages are fetched newest-first for pagination efficiency, then reversed
 * for display. The `beforeId` parameter enables loading older messages.
 *
 * ## Real-time Updates
 *
 * Uses polling rather than WebSocket. `getNewMessages` fetches messages
 * with ID greater than the last known message.
 *
 * ## Related Files
 *
 * - `src/lib/conversations.ts` - Core conversation management
 * - `src/app/(dashboard)/dashboard/messages/actions.ts` - List page actions
 * - `src/components/messages/chat-view.tsx` - Main chat UI component
 * - `src/components/messages/chat-context-panel.tsx` - Coach context sidebar
 *
 * @module dashboard/messages/[id]/actions
 */

'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or, desc, lt, ne, gt, asc, gte, sql } from 'drizzle-orm';
import {
  db,
  conversations,
  messages,
  users,
  bookings,
  transactions,
  coachProfiles,
  programs,
  goals,
} from '@/db';
import type { MessageMetadata } from '@/db/schema';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Message with enriched sender information for display.
 *
 * @property id - Database message ID
 * @property content - Message text content
 * @property messageType - 'text' for user messages, 'system' for automated
 * @property senderId - Clerk user ID of the sender
 * @property senderName - Display name of sender (may be null)
 * @property senderAvatar - Avatar URL of sender (may be null)
 * @property isOwn - Whether the current user sent this message
 * @property isRead - Whether the message has been read by recipient
 * @property createdAt - Timestamp when message was created
 */
export interface MessageAttachment {
  url: string;
  name: string | null;
  type: string | null;
  size: number | null;
}

export interface MessageWithSender {
  id: number;
  content: string;
  messageType: 'text' | 'system';
  senderId: string;
  senderName: string | null;
  senderAvatar: string | null;
  isOwn: boolean;
  isRead: boolean;
  createdAt: Date;
  metadata?: MessageMetadata | null;
  attachment?: MessageAttachment | null;
}

/**
 * Conversation details for the chat header.
 *
 * @property id - Database conversation ID
 * @property otherUserId - Clerk user ID of the other participant
 * @property otherUserName - Display name of other user (may be null)
 * @property otherUserAvatar - Avatar URL of other user (may be null)
 * @property isCoach - Whether the current user is the coach (affects UI)
 */
export interface ConversationDetails {
  id: number;
  otherUserId: string;
  otherUserName: string | null;
  otherUserAvatar: string | null;
  isCoach: boolean;
}

/**
 * Result type for getConversationDetails server action.
 */
export interface GetConversationDetailsResult {
  success: boolean;
  conversation?: ConversationDetails;
  error?: string;
}

// ============================================================================
// SERVER ACTIONS - Conversation
// ============================================================================

/**
 * Fetch conversation details for the chat header.
 *
 * Retrieves conversation metadata and other participant's info.
 * Also determines whether current user is the coach (for context panel).
 *
 * @param conversationId - Database ID of the conversation
 * @returns Result object with conversation details on success
 *
 * @example
 * const result = await getConversationDetails(123);
 * if (result.success) {
 *   console.log(`Chatting with ${result.conversation.otherUserName}`);
 * }
 *
 * @security Requires authentication. Returns 404 if user is not a participant.
 */
export async function getConversationDetails(
  conversationId: number
): Promise<GetConversationDetailsResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Get conversation and verify user is a participant
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
        )
      )
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found' };
    }

    const conversation = conversationRecords[0];
    const isCoach = conversation.coachId === userId;
    const otherUserId = isCoach ? conversation.clientId : conversation.coachId;

    // Get other user's info
    const otherUserRecords = await db
      .select({
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, otherUserId))
      .limit(1);

    const otherUser = otherUserRecords[0];

    return {
      success: true,
      conversation: {
        id: conversation.id,
        otherUserId,
        otherUserName: otherUser?.name || null,
        otherUserAvatar: otherUser?.avatarUrl || null,
        isCoach,
      },
    };
  } catch (error) {
    console.error('Error fetching conversation details:', error);
    return { success: false, error: 'Failed to fetch conversation details' };
  }
}

/**
 * Result type for getMessages server action.
 *
 * @property hasMore - Whether there are older messages to load
 */
export interface GetMessagesResult {
  success: boolean;
  messages?: MessageWithSender[];
  hasMore?: boolean;
  error?: string;
}

// ============================================================================
// SERVER ACTIONS - Messages
// ============================================================================

/**
 * Fetch paginated messages for a conversation.
 *
 * Messages are returned in chronological order (oldest to newest) for display.
 * Use `beforeId` to load older messages for infinite scroll.
 *
 * Implementation note: Fetches `limit + 1` messages to detect if more exist,
 * then returns only `limit` messages.
 *
 * @param conversationId - Database ID of the conversation
 * @param limit - Maximum messages to return (default: 50)
 * @param beforeId - Only return messages with ID less than this (for pagination)
 * @returns Result object with messages array and hasMore flag
 *
 * @example
 * // Initial load
 * const result = await getMessages(conversationId, 50);
 *
 * @example
 * // Load more (infinite scroll)
 * const oldestMessageId = messages[0].id;
 * const result = await getMessages(conversationId, 50, oldestMessageId);
 *
 * @security Requires authentication. Returns 404 if user is not a participant.
 */
export async function getMessages(
  conversationId: number,
  limit: number = 50,
  beforeId?: number
): Promise<GetMessagesResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify user is a participant
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
        )
      )
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found' };
    }

    // Build query conditions
    const conditions = [eq(messages.conversationId, conversationId)];

    if (beforeId) {
      conditions.push(lt(messages.id, beforeId));
    }

    // Fetch messages (newest first for pagination, but we'll reverse for display)
    const messagesData = await db
      .select({
        id: messages.id,
        content: messages.content,
        messageType: messages.messageType,
        senderId: messages.senderId,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        metadata: messages.metadata,
        attachmentUrl: messages.attachmentUrl,
        attachmentName: messages.attachmentName,
        attachmentType: messages.attachmentType,
        attachmentSize: messages.attachmentSize,
      })
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1); // Fetch one extra to check if there are more

    const hasMore = messagesData.length > limit;
    const messagesToReturn = hasMore ? messagesData.slice(0, limit) : messagesData;

    // Get sender info for each message
    const senderIds = Array.from(new Set(messagesToReturn.map((m) => m.senderId)));
    const senderRecords = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        senderIds.length > 0
          ? or(...senderIds.map((id) => eq(users.id, id)))
          : eq(users.id, 'nonexistent')
      );

    const senderMap = new Map(senderRecords.map((s) => [s.id, s]));

    // Map messages with sender info
    const messagesWithSender: MessageWithSender[] = messagesToReturn.map((msg) => {
      const sender = senderMap.get(msg.senderId);
      return {
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        senderId: msg.senderId,
        senderName: sender?.name || null,
        senderAvatar: sender?.avatarUrl || null,
        isOwn: msg.senderId === userId,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
        metadata: msg.metadata,
        attachment: msg.attachmentUrl
          ? {
              url: msg.attachmentUrl,
              name: msg.attachmentName,
              type: msg.attachmentType,
              size: msg.attachmentSize,
            }
          : null,
      };
    });

    // Reverse to get oldest first for display
    messagesWithSender.reverse();

    return {
      success: true,
      messages: messagesWithSender,
      hasMore,
    };
  } catch (error) {
    console.error('Error fetching messages:', error);
    return { success: false, error: 'Failed to fetch messages' };
  }
}

/**
 * Result type for markMessagesAsRead server action.
 */
export interface MarkMessagesAsReadResult {
  success: boolean;
  error?: string;
}

/**
 * Mark all messages from the other user in a conversation as read.
 *
 * Called when a user opens a conversation and when new messages arrive
 * while the conversation is open.
 *
 * Only marks messages from the OTHER user as read - never the user's own.
 *
 * @param conversationId - Database ID of the conversation
 * @returns Result object indicating success
 *
 * @example
 * // When opening a conversation
 * useEffect(() => {
 *   markMessagesAsRead(conversationId);
 * }, [conversationId]);
 *
 * @security Requires authentication. Returns 404 if user is not a participant.
 */
export async function markMessagesAsRead(
  conversationId: number
): Promise<MarkMessagesAsReadResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify user is a participant
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
        )
      )
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found' };
    }

    // Mark all messages from the other user as read
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          ne(messages.senderId, userId),
          eq(messages.isRead, false)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return { success: false, error: 'Failed to mark messages as read' };
  }
}

/**
 * Result type for sendMessage server action.
 *
 * @property message - The created message with sender info (for optimistic UI reconciliation)
 */
export interface SendMessageResult {
  success: boolean;
  message?: MessageWithSender;
  error?: string;
}

/**
 * Send a text message in a conversation.
 *
 * Creates the message record and updates the conversation's lastMessageAt.
 * Returns the full message object for optimistic UI reconciliation.
 *
 * @param conversationId - Database ID of the conversation
 * @param content - Message text (whitespace-only messages are rejected)
 * @returns Result object with created message on success
 *
 * @example
 * // With optimistic UI
 * const optimisticMsg = { id: tempId, content, isOwn: true, ... };
 * setMessages(prev => [...prev, optimisticMsg]);
 *
 * const result = await sendMessage(conversationId, content);
 * if (result.success) {
 *   // Replace optimistic with real message
 *   setMessages(prev => prev.map(m =>
 *     m.id === tempId ? result.message : m
 *   ));
 * }
 *
 * @security Requires authentication. Returns 404 if user is not a participant.
 */
export async function sendMessage(
  conversationId: number,
  content: string
): Promise<SendMessageResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  // Validate content - don't send empty/whitespace-only messages
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return { success: false, error: 'Message cannot be empty' };
  }

  try {
    // Verify user is a participant
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
        )
      )
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found' };
    }

    // Get sender's info for the response
    const senderRecords = await db
      .select({
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const sender = senderRecords[0];

    const now = new Date();

    // Create the message
    const newMessageRecords = await db
      .insert(messages)
      .values({
        conversationId,
        senderId: userId,
        content: trimmedContent,
        messageType: 'text',
        isRead: false,
      })
      .returning();

    const newMessage = newMessageRecords[0];

    // Update conversation's last_message_at
    await db
      .update(conversations)
      .set({ lastMessageAt: now })
      .where(eq(conversations.id, conversationId));

    // Return the message with sender info
    return {
      success: true,
      message: {
        id: newMessage.id,
        content: newMessage.content,
        messageType: newMessage.messageType,
        senderId: newMessage.senderId,
        senderName: sender?.name || null,
        senderAvatar: sender?.avatarUrl || null,
        isOwn: true,
        isRead: newMessage.isRead,
        createdAt: newMessage.createdAt,
        metadata: newMessage.metadata,
        attachment: null,
      },
    };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: 'Failed to send message' };
  }
}

/**
 * Result type for getNewMessages server action.
 */
export interface GetNewMessagesResult {
  success: boolean;
  messages?: MessageWithSender[];
  error?: string;
}

// ============================================================================
// TYPE DEFINITIONS - Client Context (Coach View)
// ============================================================================

/**
 * Goal data for the client progress panel.
 */
export interface GoalForContext {
  id: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
}

/**
 * Program with nested goals for the client progress panel.
 */
export interface ProgramForContext {
  id: number;
  title: string;
  status: 'active' | 'completed' | 'archived';
  goals: GoalForContext[];
}

/**
 * Client context data for the coach's chat sidebar panel.
 *
 * Provides coaches with helpful information about the client they're chatting with,
 * including session history, spending, upcoming appointments, and program progress.
 *
 * @property pastSessionsCount - Number of completed/past sessions with this client
 * @property totalSpentCents - Total amount paid by client (in cents)
 * @property upcomingSessions - Next 3 upcoming sessions
 * @property coachSlug - For "Book Session" quick link
 * @property programs - Active programs with goals for progress tracking
 */
export interface ClientContext {
  clientId: string;
  clientName: string | null;
  clientAvatar: string | null;
  pastSessionsCount: number;
  totalSpentCents: number;
  currency: string;
  upcomingSessions: {
    id: number;
    sessionTypeName: string;
    startTime: Date;
  }[];
  coachSlug: string;
  programs: ProgramForContext[];
}

/**
 * Result type for getClientContext server action.
 */
export interface GetClientContextResult {
  success: boolean;
  context?: ClientContext;
  error?: string;
}

// ============================================================================
// SERVER ACTIONS - Client Context (Coach View Only)
// ============================================================================

/**
 * Fetch client context data for the coach's chat sidebar.
 *
 * This is only available when the current user is the COACH in the conversation.
 * Returns an error if the user is the client.
 *
 * Data includes:
 * - Past sessions count and total spent
 * - Next 3 upcoming sessions
 * - Last 10 action items (pending first, then completed)
 *
 * @param conversationId - Database ID of the conversation
 * @returns Result object with client context on success
 *
 * @example
 * // In chat page server component (coach view)
 * const contextResult = await getClientContext(conversationId);
 * return <ChatView clientContext={contextResult.success ? contextResult.context : null} />;
 *
 * @security Requires authentication. User must be the COACH in this conversation.
 */
export async function getClientContext(conversationId: number): Promise<GetClientContextResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify conversation exists and user is the coach
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.coachId, userId)))
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found or not a coach' };
    }

    const conversation = conversationRecords[0];
    const clientId = conversation.clientId;

    // Get client info
    const clientRecords = await db
      .select({
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);

    const client = clientRecords[0];

    // Get coach profile for slug and currency
    const coachProfileRecords = await db
      .select({
        slug: coachProfiles.slug,
        currency: coachProfiles.currency,
      })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    const coachProfile = coachProfileRecords[0];
    const currency = coachProfile?.currency || 'USD';
    const coachSlug = coachProfile?.slug || '';

    // Get past sessions count
    const now = new Date();
    const pastSessionsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.coachId, userId),
          eq(bookings.clientId, clientId),
          lt(bookings.startTime, now),
          or(
            eq(bookings.status, 'completed'),
            eq(bookings.status, 'confirmed'),
            eq(bookings.status, 'pending')
          )
        )
      );

    const pastSessionsCount = pastSessionsResult[0]?.count || 0;

    // Get total spent from succeeded transactions
    const totalSpentResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.coachId, userId),
          eq(transactions.clientId, clientId),
          eq(transactions.status, 'succeeded')
        )
      );

    const totalSpentCents = totalSpentResult[0]?.total || 0;

    // Get upcoming sessions (next 3)
    const upcomingSessionsRecords = await db
      .select({
        id: bookings.id,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.coachId, userId),
          eq(bookings.clientId, clientId),
          gte(bookings.startTime, now),
          or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'pending'))
        )
      )
      .orderBy(asc(bookings.startTime))
      .limit(3);

    const upcomingSessions = upcomingSessionsRecords.map((session) => ({
      id: session.id,
      sessionTypeName: (session.sessionType as { name: string }).name,
      startTime: session.startTime,
    }));

    // Get active programs with their goals for this coach-client pair
    const programRecords = await db
      .select({
        id: programs.id,
        title: programs.title,
        status: programs.status,
      })
      .from(programs)
      .where(
        and(
          eq(programs.coachId, userId),
          eq(programs.clientId, clientId),
          eq(programs.status, 'active')
        )
      )
      .orderBy(desc(programs.createdAt));

    // Get goals for all active programs
    const programIds = programRecords.map((p) => p.id);
    let goalRecords: {
      id: number;
      programId: number;
      title: string;
      status: 'pending' | 'in_progress' | 'completed';
      priority: 'low' | 'medium' | 'high';
      dueDate: string | null;
    }[] = [];

    if (programIds.length > 0) {
      goalRecords = await db
        .select({
          id: goals.id,
          programId: goals.programId,
          title: goals.title,
          status: goals.status,
          priority: goals.priority,
          dueDate: goals.dueDate,
        })
        .from(goals)
        .where(or(...programIds.map((pid) => eq(goals.programId, pid))))
        .orderBy(asc(goals.createdAt));
    }

    // Group goals by program
    const goalsByProgram = new Map<number, GoalForContext[]>();
    for (const goal of goalRecords) {
      const list = goalsByProgram.get(goal.programId) || [];
      list.push({
        id: goal.id,
        title: goal.title,
        status: goal.status,
        priority: goal.priority,
        dueDate: goal.dueDate,
      });
      goalsByProgram.set(goal.programId, list);
    }

    const clientPrograms: ProgramForContext[] = programRecords.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      goals: goalsByProgram.get(p.id) || [],
    }));

    return {
      success: true,
      context: {
        clientId,
        clientName: client?.name || null,
        clientAvatar: client?.avatarUrl || null,
        pastSessionsCount,
        totalSpentCents,
        currency,
        upcomingSessions,
        coachSlug,
        programs: clientPrograms,
      },
    };
  } catch (error) {
    console.error('Error fetching client context:', error);
    return { success: false, error: 'Failed to fetch client context' };
  }
}

// ============================================================================
// SERVER ACTIONS - Polling
// ============================================================================

/**
 * Fetch messages newer than a given message ID for polling.
 *
 * Used by the chat view to poll for new messages every 3 seconds.
 * Returns messages in chronological order (oldest to newest).
 *
 * Implementation note: Uses message ID comparison rather than timestamp
 * to ensure no messages are missed due to clock differences.
 *
 * @param conversationId - Database ID of the conversation
 * @param afterId - Only return messages with ID greater than this
 * @returns Result object with new messages array (may be empty)
 *
 * @example
 * // Polling loop in useEffect
 * const pollForNewMessages = async () => {
 *   const lastId = messages[messages.length - 1].id;
 *   const result = await getNewMessages(conversationId, lastId);
 *   if (result.success && result.messages.length > 0) {
 *     setMessages(prev => [...prev, ...result.messages]);
 *   }
 * };
 * const interval = setInterval(pollForNewMessages, 3000);
 *
 * @security Requires authentication. Returns 404 if user is not a participant.
 */
export async function getNewMessages(
  conversationId: number,
  afterId: number
): Promise<GetNewMessagesResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify user is a participant
    const conversationRecords = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          or(eq(conversations.coachId, userId), eq(conversations.clientId, userId))
        )
      )
      .limit(1);

    if (conversationRecords.length === 0) {
      return { success: false, error: 'Conversation not found' };
    }

    // Fetch messages newer than afterId, ordered by creation time ascending
    const newMessagesData = await db
      .select({
        id: messages.id,
        content: messages.content,
        messageType: messages.messageType,
        senderId: messages.senderId,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        metadata: messages.metadata,
        attachmentUrl: messages.attachmentUrl,
        attachmentName: messages.attachmentName,
        attachmentType: messages.attachmentType,
        attachmentSize: messages.attachmentSize,
      })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), gt(messages.id, afterId)))
      .orderBy(asc(messages.createdAt));

    if (newMessagesData.length === 0) {
      return { success: true, messages: [] };
    }

    // Get sender info for each message
    const senderIds = Array.from(new Set(newMessagesData.map((m) => m.senderId)));
    const senderRecords = await db
      .select({
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        senderIds.length > 0
          ? or(...senderIds.map((id) => eq(users.id, id)))
          : eq(users.id, 'nonexistent')
      );

    const senderMap = new Map(senderRecords.map((s) => [s.id, s]));

    // Map messages with sender info
    const messagesWithSender: MessageWithSender[] = newMessagesData.map((msg) => {
      const msgSender = senderMap.get(msg.senderId);
      return {
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        senderId: msg.senderId,
        senderName: msgSender?.name || null,
        senderAvatar: msgSender?.avatarUrl || null,
        isOwn: msg.senderId === userId,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
        metadata: msg.metadata,
        attachment: msg.attachmentUrl
          ? {
              url: msg.attachmentUrl,
              name: msg.attachmentName,
              type: msg.attachmentType,
              size: msg.attachmentSize,
            }
          : null,
      };
    });

    return {
      success: true,
      messages: messagesWithSender,
    };
  } catch (error) {
    console.error('Error fetching new messages:', error);
    return { success: false, error: 'Failed to fetch new messages' };
  }
}
