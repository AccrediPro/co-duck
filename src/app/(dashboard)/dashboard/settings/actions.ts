'use server';

import { auth } from '@clerk/nextjs/server';
import { db, googleCalendarTokens } from '@/db';
import { eq } from 'drizzle-orm';
import { isGoogleCalendarConfigured } from '@/lib/google-calendar';

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
