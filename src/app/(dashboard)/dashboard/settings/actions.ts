'use server';

import { auth } from '@clerk/nextjs/server';
import { db, googleCalendarTokens } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isGoogleCalendarConfigured } from '@/lib/google-calendar';

/**
 * Update the current user's display name in the database.
 */
export async function updateDisplayName(
  name: string
): Promise<{ success: true; name: string } | { success: false; error: string }> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be signed in' };
    }

    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) {
      return { success: false, error: 'Name must be between 1 and 100 characters' };
    }

    const [updated] = await db
      .update(users)
      .set({ name: trimmed })
      .where(eq(users.id, userId))
      .returning({ name: users.name });

    return { success: true, name: updated.name || trimmed };
  } catch (error) {
    console.error('Error updating display name:', error);
    return { success: false, error: 'Failed to update display name' };
  }
}

export interface GoogleCalendarStatus {
  isConfigured: boolean;
  isConnected: boolean;
  lastSyncAt: Date | null;
}

/**
 * Get the current user's Google Calendar connection status.
 * Returns isConfigured: false when env vars are missing (feature disabled).
 */
export async function getGoogleCalendarStatus(): Promise<
  { success: true; data: GoogleCalendarStatus } | { success: false; error: string }
> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be signed in' };
    }

    if (!isGoogleCalendarConfigured()) {
      return { success: true, data: { isConfigured: false, isConnected: false, lastSyncAt: null } };
    }

    const tokens = await db
      .select({
        isConnected: googleCalendarTokens.isConnected,
        lastSyncAt: googleCalendarTokens.lastSyncAt,
      })
      .from(googleCalendarTokens)
      .where(eq(googleCalendarTokens.userId, userId))
      .limit(1);

    if (tokens.length === 0) {
      return { success: true, data: { isConfigured: true, isConnected: false, lastSyncAt: null } };
    }

    return {
      success: true,
      data: {
        isConfigured: true,
        isConnected: tokens[0].isConnected,
        lastSyncAt: tokens[0].lastSyncAt,
      },
    };
  } catch (error) {
    console.error('Error getting Google Calendar status:', error);
    return { success: false, error: 'Failed to get calendar status' };
  }
}

/**
 * Disconnect Google Calendar integration for the current user.
 * Removes stored tokens and marks as disconnected.
 */
export async function disconnectGoogleCalendar(): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be signed in' };
    }

    await db.delete(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId));

    return { success: true };
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    return { success: false, error: 'Failed to disconnect calendar' };
  }
}
