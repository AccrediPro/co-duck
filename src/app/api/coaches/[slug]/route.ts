/**
 * @fileoverview Get Coach Profile API
 *
 * Returns public profile for a specific coach by slug.
 *
 * @module api/coaches/[slug]
 */

import { db } from '@/db';
import { users, coachProfiles, coachAvailability } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/coaches/:slug
 *
 * Returns the public profile of a coach by their URL slug.
 *
 * @param {string} slug - Coach's URL slug (e.g., "john-smith")
 *
 * @returns {Object} Coach profile data
 *
 * @example Response
 * {
 *   "success": true,
 *   "data": {
 *     "id": "user_xxx",
 *     "slug": "john-smith",
 *     "name": "John Smith",
 *     "avatarUrl": "https://...",
 *     "headline": "Executive Coach",
 *     "bio": "...",
 *     "specialties": ["Career Coaching", "Leadership"],
 *     "sessionTypes": [...],
 *     "timezone": "America/New_York",
 *     "availability": {
 *       "bufferMinutes": 15,
 *       "advanceNoticeHours": 24,
 *       "maxAdvanceDays": 60,
 *       "weeklySchedule": [...]
 *     }
 *   }
 * }
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // Get coach profile with user info
    const coach = await db
      .select({
        userId: coachProfiles.userId,
        slug: coachProfiles.slug,
        headline: coachProfiles.headline,
        bio: coachProfiles.bio,
        specialties: coachProfiles.specialties,
        sessionTypes: coachProfiles.sessionTypes,
        timezone: coachProfiles.timezone,
        hourlyRate: coachProfiles.hourlyRate,
        currency: coachProfiles.currency,
        videoIntroUrl: coachProfiles.videoIntroUrl,
        bufferMinutes: coachProfiles.bufferMinutes,
        advanceNoticeHours: coachProfiles.advanceNoticeHours,
        maxAdvanceDays: coachProfiles.maxAdvanceDays,
        isPublished: coachProfiles.isPublished,
        userName: users.name,
        userEmail: users.email,
        userAvatar: users.avatarUrl,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(users.id, coachProfiles.userId))
      .where(eq(coachProfiles.slug, slug))
      .limit(1);

    if (coach.length === 0) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Coach not found' } },
        { status: 404 }
      );
    }

    const coachData = coach[0];

    // Check if coach is published (unless viewing own profile)
    if (!coachData.isPublished) {
      return Response.json(
        { success: false, error: { code: 'NOT_PUBLISHED', message: 'Coach profile is not published' } },
        { status: 404 }
      );
    }

    // Get weekly availability
    const availability = await db
      .select({
        dayOfWeek: coachAvailability.dayOfWeek,
        startTime: coachAvailability.startTime,
        endTime: coachAvailability.endTime,
        isAvailable: coachAvailability.isAvailable,
      })
      .from(coachAvailability)
      .where(eq(coachAvailability.coachId, coachData.userId))
      .orderBy(coachAvailability.dayOfWeek);

    return Response.json({
      success: true,
      data: {
        id: coachData.userId,
        slug: coachData.slug,
        name: coachData.userName,
        avatarUrl: coachData.userAvatar,
        headline: coachData.headline,
        bio: coachData.bio,
        specialties: coachData.specialties,
        sessionTypes: coachData.sessionTypes,
        timezone: coachData.timezone,
        hourlyRate: coachData.hourlyRate,
        currency: coachData.currency,
        videoIntroUrl: coachData.videoIntroUrl,
        availability: {
          bufferMinutes: coachData.bufferMinutes,
          advanceNoticeHours: coachData.advanceNoticeHours,
          maxAdvanceDays: coachData.maxAdvanceDays,
          weeklySchedule: availability,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching coach:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch coach' } },
      { status: 500 }
    );
  }
}
