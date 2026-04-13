import { db } from '@/db';
import { pushTokens } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  data?: {
    type: string;
    link?: string;
    [key: string]: unknown;
  };
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data?: Record<string, unknown>;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

// ─── Constants ───────────────────────────────────────

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo recommends max 100 per request

// ─── Public API ──────────────────────────────────────

/**
 * Send push notification to all devices belonging to a single user.
 * Fire-and-forget — logs errors but never throws.
 */
export async function sendPushNotification(userId: string, payload: PushPayload): Promise<void> {
  try {
    const tokens = await db
      .select({ id: pushTokens.id, token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId));

    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      sound: 'default' as const,
      ...(payload.data ? { data: payload.data } : {}),
    }));

    await sendBatched(
      messages,
      tokens.map((t) => ({ id: t.id, token: t.token }))
    );
  } catch (error) {
    console.error('[push] Failed to send push notification:', error);
  }
}

/**
 * Send push notification to all devices belonging to multiple users.
 * Fire-and-forget — logs errors but never throws.
 */
export async function sendPushNotifications(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const tokens = await db
      .select({ id: pushTokens.id, token: pushTokens.token })
      .from(pushTokens)
      .where(inArray(pushTokens.userId, userIds));

    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      sound: 'default' as const,
      ...(payload.data ? { data: payload.data } : {}),
    }));

    await sendBatched(
      messages,
      tokens.map((t) => ({ id: t.id, token: t.token }))
    );
  } catch (error) {
    console.error('[push] Failed to send push notifications:', error);
  }
}

// ─── Internal ────────────────────────────────────────

/**
 * Send messages in batches of BATCH_SIZE (100).
 * Handles DeviceNotRegistered errors by deleting stale tokens.
 */
async function sendBatched(
  messages: ExpoPushMessage[],
  tokenMap: { id: number; token: string }[]
): Promise<void> {
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const batchTokens = tokenMap.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error(`[push] Expo API returned ${response.status}: ${await response.text()}`);
        continue;
      }

      const result = await response.json();
      const tickets: ExpoPushTicket[] = result.data || [];

      // Clean up stale tokens
      const staleTokenIds: number[] = [];
      tickets.forEach((ticket, idx) => {
        if (
          ticket.status === 'error' &&
          ticket.details?.error === 'DeviceNotRegistered' &&
          batchTokens[idx]
        ) {
          staleTokenIds.push(batchTokens[idx].id);
          console.warn(`[push] Token ${batchTokens[idx].token} is not registered — removing`);
        }
      });

      if (staleTokenIds.length > 0) {
        await db
          .delete(pushTokens)
          .where(inArray(pushTokens.id, staleTokenIds))
          .catch((err) => console.error('[push] Failed to delete stale tokens:', err));
      }
    } catch (error) {
      console.error('[push] Failed to send batch:', error);
    }
  }
}
