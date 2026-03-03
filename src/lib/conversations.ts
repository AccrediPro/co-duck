/**
 * @fileoverview Conversation management utilities for the messaging system.
 *
 * This module provides server actions and internal functions for managing
 * conversations between coaches and clients in the coaching platform.
 *
 * ## Architecture
 *
 * The messaging system follows a 1-to-1 conversation model:
 * - Each coach-client pair has exactly ONE conversation (enforced by unique constraint)
 * - Conversations are created lazily when first message is needed
 * - System messages are used for automated notifications (bookings, cancellations)
 *
 * ## Message Types
 *
 * - `text`: Regular user-sent messages
 * - `system`: Automated messages (booking confirmations, etc.)
 *
 * ## Security
 *
 * - `getOrCreateConversation`: Requires auth, validates user is participant
 * - `getOrCreateConversationInternal`: No auth - for system processes only
 * - `sendSystemMessage`: No auth - for system processes only
 *
 * ## Related Files
 *
 * - `src/app/(dashboard)/dashboard/messages/actions.ts` - Conversation list actions
 * - `src/app/(dashboard)/dashboard/messages/[id]/actions.ts` - Chat view actions
 * - `src/components/messages/` - UI components
 * - `src/db/schema.ts` - Database tables (conversations, messages)
 *
 * @module lib/conversations
 */

'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or } from 'drizzle-orm';
import { db, conversations, messages, users, coachProfiles } from '@/db';
import { formatDateLong, formatTime } from '@/lib/date-utils';
import type { BookingSessionType } from '@/db/schema';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result type for getOrCreateConversation server action.
 *
 * @property success - Whether the operation succeeded
 * @property conversationId - The conversation ID (on success)
 * @property error - Error message (on failure)
 */
export interface GetOrCreateConversationResult {
  success: boolean;
  conversationId?: number;
  error?: string;
}

// ============================================================================
// SERVER ACTIONS (Require Authentication)
// ============================================================================

/**
 * Get an existing conversation between a coach and client, or create a new one.
 *
 * This is the primary entry point for starting/resuming a conversation from the UI.
 * It validates authentication and ensures the requesting user is a participant.
 *
 * @param coachId - Clerk user ID of the coach (must have a coach_profiles record)
 * @param clientId - Clerk user ID of the client
 * @returns Result object with conversationId on success, error on failure
 *
 * @throws Never throws - errors are returned in the result object
 *
 * @example
 * // From a "Message Coach" button on a coach profile
 * const result = await getOrCreateConversation(coachUserId, currentUserId);
 * if (result.success) {
 *   router.push(`/dashboard/messages/${result.conversationId}`);
 * } else {
 *   toast({ title: 'Error', description: result.error });
 * }
 *
 * @security Requires authentication. User must be either the coach or client.
 */
export async function getOrCreateConversation(
  coachId: string,
  clientId: string
): Promise<GetOrCreateConversationResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  // Verify the current user is either the coach or the client
  if (userId !== coachId && userId !== clientId) {
    return { success: false, error: 'Unauthorized to access this conversation' };
  }

  try {
    // Verify both users exist
    const usersExist = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.id, coachId), eq(users.id, clientId)));

    if (usersExist.length < 2) {
      return { success: false, error: 'One or both users not found' };
    }

    // Check for existing conversation
    const existingConversation = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.coachId, coachId), eq(conversations.clientId, clientId)))
      .limit(1);

    if (existingConversation.length > 0) {
      return { success: true, conversationId: existingConversation[0].id };
    }

    // Verify coachId is actually a coach (has a coach profile)
    const coachProfile = await db
      .select({ userId: coachProfiles.userId })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, coachId))
      .limit(1);

    if (coachProfile.length === 0) {
      return { success: false, error: 'The specified coach does not have a coach profile' };
    }

    // Create new conversation
    const newConversation = await db
      .insert(conversations)
      .values({
        coachId,
        clientId,
      })
      .returning({ id: conversations.id });

    if (newConversation.length === 0) {
      return { success: false, error: 'Failed to create conversation' };
    }

    return { success: true, conversationId: newConversation[0].id };
  } catch (error) {
    console.error('Error getting or creating conversation:', error);
    return { success: false, error: 'Failed to get or create conversation' };
  }
}

/**
 * Result type for sendSystemMessage function.
 *
 * @property success - Whether the message was sent successfully
 * @property messageId - The created message ID (on success)
 * @property error - Error message (on failure)
 */
export interface SendSystemMessageResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

// ============================================================================
// INTERNAL FUNCTIONS (No Authentication - System Use Only)
// ============================================================================

/**
 * Send a system message to a conversation.
 *
 * System messages are used for automated notifications such as:
 * - Booking confirmations
 * - Session cancellations
 * - Reschedule notifications
 *
 * @param conversationId - Database ID of the conversation
 * @param content - The message text to send
 * @param senderId - Clerk user ID to attribute the message to (for display)
 * @returns Result object with messageId on success
 *
 * @example
 * // Send booking confirmation message
 * const result = await sendSystemMessage(
 *   conversationId,
 *   'Session booked: Career Coaching on Monday at 2:00 PM',
 *   clientId
 * );
 *
 * @internal This function has NO authentication check - only use from
 * trusted server-side code (webhooks, other server actions).
 */
export async function sendSystemMessage(
  conversationId: number,
  content: string,
  senderId: string
): Promise<SendSystemMessageResult> {
  try {
    // Create the system message
    const newMessage = await db
      .insert(messages)
      .values({
        conversationId,
        senderId,
        content,
        messageType: 'system',
        isRead: false,
      })
      .returning({ id: messages.id });

    if (newMessage.length === 0) {
      return { success: false, error: 'Failed to create system message' };
    }

    // Update conversation's last_message_at
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return { success: true, messageId: newMessage[0].id };
  } catch (error) {
    console.error('Error sending system message:', error);
    return { success: false, error: 'Failed to send system message' };
  }
}

/**
 * Internal function to get or create a conversation without authentication.
 *
 * Unlike `getOrCreateConversation`, this function:
 * - Does NOT verify authentication
 * - Does NOT verify the coach has a coach profile
 * - Is intended for system processes (webhooks, background jobs)
 *
 * @param coachId - Clerk user ID of the coach
 * @param clientId - Clerk user ID of the client
 * @returns Discriminated union with conversationId on success, error on failure
 *
 * @example
 * // From a webhook handler
 * const result = await getOrCreateConversationInternal(coachId, clientId);
 * if (result.success) {
 *   await sendSystemMessage(result.conversationId, message, clientId);
 * }
 *
 * @internal This function has NO authentication check - only use from
 * trusted server-side code (webhooks, other server actions).
 */
export async function getOrCreateConversationInternal(
  coachId: string,
  clientId: string
): Promise<{ success: true; conversationId: number } | { success: false; error: string }> {
  try {
    // Check for existing conversation
    const existingConversation = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.coachId, coachId), eq(conversations.clientId, clientId)))
      .limit(1);

    if (existingConversation.length > 0) {
      return { success: true, conversationId: existingConversation[0].id };
    }

    // Create new conversation
    const newConversation = await db
      .insert(conversations)
      .values({
        coachId,
        clientId,
      })
      .returning({ id: conversations.id });

    if (newConversation.length === 0) {
      return { success: false, error: 'Failed to create conversation' };
    }

    return { success: true, conversationId: newConversation[0].id };
  } catch (error) {
    console.error('Error getting or creating conversation (internal):', error);
    return { success: false, error: 'Failed to get or create conversation' };
  }
}

// ============================================================================
// BOOKING INTEGRATION
// ============================================================================

/**
 * Create a system message notifying about a new booking.
 *
 * This is the primary integration point between the booking flow and messaging.
 * It creates/finds the conversation and sends a formatted notification.
 *
 * The message format is:
 * "Session booked: {sessionTypeName} on {date} at {time}"
 *
 * @param coachId - Clerk user ID of the coach
 * @param clientId - Clerk user ID of the client who booked
 * @param sessionType - The booked session type (name, duration, price snapshot)
 * @param startTime - The scheduled session start time
 * @returns Result object indicating success or failure
 *
 * @example
 * // After successful payment/booking confirmation
 * await createBookingSystemMessage(
 *   booking.coachId,
 *   booking.clientId,
 *   booking.sessionType as BookingSessionType,
 *   booking.startTime
 * );
 *
 * @see BookingSessionType for session type structure (from schema.ts)
 * @internal Called from booking confirmation flow (webhook or success page)
 */
export async function createBookingSystemMessage(
  coachId: string,
  clientId: string,
  sessionType: BookingSessionType,
  startTime: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get or create the conversation
    const conversationResult = await getOrCreateConversationInternal(coachId, clientId);

    if (!conversationResult.success) {
      return { success: false, error: conversationResult.error };
    }

    // Format the date for the message
    const formattedDate = formatDateLong(startTime);
    const formattedTime = formatTime(startTime);

    // Create the system message content
    const messageContent = `Session booked: ${sessionType.name} on ${formattedDate} at ${formattedTime}`;

    // Send the system message (using the client as the sender for display purposes)
    const messageResult = await sendSystemMessage(
      conversationResult.conversationId,
      messageContent,
      clientId
    );

    if (!messageResult.success) {
      return { success: false, error: messageResult.error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating booking system message:', error);
    return { success: false, error: 'Failed to create booking system message' };
  }
}
