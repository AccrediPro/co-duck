/**
 * @fileoverview Get Current User Profile API
 *
 * Returns the authenticated user's profile including role.
 * Used by mobile app to get user data after Clerk authentication.
 *
 * @module api/auth/me
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, coachProfiles, coachAvailability } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile with role.
 *
 * @returns {Object} User profile data
 *
 * @example Response (success)
 * {
 *   "success": true,
 *   "data": {
 *     "id": "user_xxx",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "avatarUrl": "https://...",
 *     "role": "client",
 *     "coachProfile": null
 *   }
 * }
 *
 * @example Response (coach)
 * {
 *   "success": true,
 *   "data": {
 *     "id": "user_xxx",
 *     "email": "coach@example.com",
 *     "name": "Jane Coach",
 *     "avatarUrl": "https://...",
 *     "role": "coach",
 *     "coachProfile": {
 *       "slug": "jane-coach",
 *       "headline": "Executive Coach",
 *       "isPublished": true
 *     }
 *   }
 * }
 */
export async function GET(request: Request) {
  // Rate limit: 30 requests per minute
  const rl = rateLimit(request, FREQUENT_LIMIT, 'auth-me-get');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return Response.json(
        {
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found in database' },
        },
        { status: 404 }
      );
    }

    // If user is a coach, include coach profile + availability check
    let coachProfile = null;
    let hasAvailability = false;
    if (user.role === 'coach') {
      const [profile, availabilityCount] = await Promise.all([
        db.query.coachProfiles.findFirst({
          where: eq(coachProfiles.userId, userId),
        }),
        db
          .select({ count: sql<number>`count(*)` })
          .from(coachAvailability)
          .where(
            and(eq(coachAvailability.coachId, userId), eq(coachAvailability.isAvailable, true))
          ),
      ]);
      coachProfile = profile ?? null;
      hasAvailability = Number(availabilityCount[0]?.count ?? 0) > 0;
    }

    return Response.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
        coachProfile: coachProfile
          ? {
              slug: coachProfile.slug,
              headline: coachProfile.headline,
              bio: coachProfile.bio,
              specialties: coachProfile.specialties,
              timezone: coachProfile.timezone,
              sessionTypes: coachProfile.sessionTypes,
              isPublished: coachProfile.isPublished,
              stripeOnboardingComplete: coachProfile.stripeOnboardingComplete,
              stripeAccountId: coachProfile.stripeAccountId,
              hasAvailability,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' } },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH - Update user profile
// ─────────────────────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
});

/**
 * PATCH /api/auth/me
 *
 * Updates the authenticated user's profile fields.
 *
 * @body {string} [name] - Display name (1-100 chars)
 * @body {string} [phone] - Phone number (max 20 chars)
 *
 * @returns {Object} Updated user profile
 */
export async function PATCH(request: Request) {
  // Rate limit: 10 requests per minute
  const rl = rateLimit(request, WRITE_LIMIT, 'auth-me-patch');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((i) => i.message).join(', '),
          },
        },
        { status: 400 }
      );
    }

    const { name, phone } = parsed.data;

    // Check at least one field is being updated
    if (name === undefined && phone === undefined) {
      return Response.json(
        { success: false, error: { code: 'NO_UPDATES', message: 'No valid updates provided' } },
        { status: 400 }
      );
    }

    // Verify user exists
    const existing = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!existing) {
      return Response.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Build update
    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
        role: updated.role,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } },
      { status: 500 }
    );
  }
}
