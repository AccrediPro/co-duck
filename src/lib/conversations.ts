'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or } from 'drizzle-orm';
import { db, conversations, messages, users, coachProfiles } from '@/db';
import { format } from 'date-fns';
import type { BookingSessionType } from '@/db/schema';

export interface GetOrCreateConversationResult {
  success: boolean;
  conversationId?: number;
  error?: string;
}

/**
 * Get an existing conversation between a coach and client, or create a new one if it doesn't exist.
 * The coachId must be a user who has a coach profile.
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

export interface SendSystemMessageResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Send a system message to a conversation.
 * Used for automated messages like booking confirmations.
 * This does not require auth - it's used by system processes.
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
 * Internal function to get or create conversation by coach and client IDs.
 * Does not require auth - for use by system processes.
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

/**
 * Create a system message for a new booking.
 * Gets or creates the conversation, then sends a system message about the booking.
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
    const formattedDate = format(startTime, 'EEEE, MMMM d, yyyy');
    const formattedTime = format(startTime, 'h:mm a');

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
