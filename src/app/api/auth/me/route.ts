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
import { users, coachProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
export async function GET() {
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
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found in database' } },
        { status: 404 }
      );
    }

    // If user is a coach, include coach profile
    let coachProfile = null;
    if (user.role === 'coach') {
      coachProfile = await db.query.coachProfiles.findFirst({
        where: eq(coachProfiles.userId, userId),
      });
    }

    return Response.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
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
