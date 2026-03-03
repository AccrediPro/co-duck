/**
 * @fileoverview Coach Profile Publish Toggle API
 *
 * REST endpoint for publishing or unpublishing a coach's profile. Mirrors the
 * `togglePublishProfile` server action so that mobile clients can toggle visibility.
 *
 * @module api/coach-profile/publish
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { coachProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import type { RateLimitConfig } from '@/lib/rate-limit';

/** 5 requests per minute for publish toggles */
const PUBLISH_TOGGLE_LIMIT: RateLimitConfig = { limit: 5, windowMs: 60_000 };

const publishSchema = z.object({
  isPublished: z.boolean(),
});

/**
 * POST /api/coach-profile/publish
 *
 * Publishes or unpublishes the authenticated coach's profile. Mirrors `togglePublishProfile`.
 *
 * Rate limit: 5 req/min
 *
 * @body {boolean} isPublished - true to publish, false to unpublish
 *
 * @returns {{ success: true, data: { isPublished: boolean } }}
 */
export async function POST(request: Request) {
  const rl = rateLimit(request, PUBLISH_TOGGLE_LIMIT, 'coach-profile-publish');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = publishSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    const { isPublished } = parsed.data;

    // Verify coach profile exists before updating
    const existing = await db
      .select({ userId: coachProfiles.userId })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      return Response.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Profile not found. Please complete onboarding first.' },
        },
        { status: 404 }
      );
    }

    await db
      .update(coachProfiles)
      .set({ isPublished })
      .where(eq(coachProfiles.userId, userId));

    return Response.json({
      success: true,
      data: { isPublished },
    });
  } catch (error) {
    console.error('Error toggling publish status:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update publish status' } },
      { status: 500 }
    );
  }
}
