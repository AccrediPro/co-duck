/**
 * @fileoverview Push Token Registration API
 *
 * Handles registration and unregistration of Expo push tokens for mobile notifications.
 * Tokens are stored per (userId, deviceId) pair — re-registering the same device
 * updates the token rather than creating a duplicate.
 *
 * @module api/push-tokens
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pushTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, rateLimitResponse, WRITE_LIMIT } from '@/lib/rate-limit';

/**
 * POST /api/push-tokens
 *
 * Registers or updates a push token for the authenticated user.
 * If the (userId, deviceId) pair already exists, the token and platform are updated.
 *
 * @body {string} token - Expo push token (must start with ExponentPushToken[ or ExpoPushToken[)
 * @body {string} platform - Device platform: 'ios', 'android', or 'web'
 * @body {string} deviceId - Unique device identifier (used to prevent duplicate registrations)
 *
 * @returns Created or updated push token record
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(request, WRITE_LIMIT, 'push-tokens-register');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { token, platform, deviceId } = body;

    if (
      !token ||
      typeof token !== 'string' ||
      (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken['))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid Expo push token format' },
        },
        { status: 400 }
      );
    }

    if (!platform || !['ios', 'android', 'web'].includes(platform)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_PLATFORM', message: 'Platform must be ios, android, or web' },
        },
        { status: 400 }
      );
    }

    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DEVICE', message: 'deviceId is required' } },
        { status: 400 }
      );
    }

    const [result] = await db
      .insert(pushTokens)
      .values({
        userId,
        token,
        platform,
        deviceId: deviceId.trim(),
      })
      .onConflictDoUpdate({
        target: [pushTokens.userId, pushTokens.deviceId],
        set: { token, platform, updatedAt: new Date() },
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        token: result.token,
        platform: result.platform,
        deviceId: result.deviceId,
      },
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to register push token' },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push-tokens?deviceId=<id>
 *
 * Unregisters a push token for the authenticated user on a specific device.
 * Safe to call on logout — deletes only the caller's token for the given device.
 *
 * @query {string} deviceId - Device identifier to unregister
 *
 * @returns Success confirmation
 */
export async function DELETE(request: NextRequest) {
  const rl = rateLimit(request, WRITE_LIMIT, 'push-tokens-unregister');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_DEVICE_ID', message: 'deviceId query parameter is required' },
        },
        { status: 400 }
      );
    }

    await db
      .delete(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.deviceId, deviceId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unregistering push token:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to unregister push token' },
      },
      { status: 500 }
    );
  }
}
