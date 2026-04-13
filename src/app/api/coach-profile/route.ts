/**
 * @fileoverview Coach Profile REST API
 *
 * REST endpoint for updating a coach's profile. Mirrors the `saveProfile` server action
 * so that mobile clients (which cannot call Server Actions) can update profile data.
 *
 * @module api/coach-profile
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { coachProfiles, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  SUPPORTED_CURRENCIES,
  SESSION_DURATIONS,
  generateSlug,
} from '@/lib/validators/coach-onboarding';
import type { SessionDuration } from '@/lib/validators/coach-onboarding';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import type { RateLimitConfig } from '@/lib/rate-limit';

/** 10 requests per minute for profile saves */
const PROFILE_SAVE_LIMIT: RateLimitConfig = { limit: 10, windowMs: 60_000 };

/**
 * API-layer schema for session types.
 * Mobile clients send price in DOLLARS — we convert to cents on write.
 */
const apiSessionTypeSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .min(1, 'Session name is required')
    .max(100, 'Name must be less than 100 characters'),
  duration: z.number().refine((val) => SESSION_DURATIONS.includes(val as SessionDuration), {
    message: 'Please select a valid duration',
  }),
  /** Price in DOLLARS from client — converted to cents before DB write */
  price: z.number().min(0, 'Price must be 0 or greater'),
});

const patchProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must be less than 100 characters'),
  headline: z
    .string()
    .min(10, 'Headline must be at least 10 characters')
    .max(150, 'Headline must be less than 150 characters'),
  bio: z.string().max(2000, 'Bio must be less than 2000 characters').optional().or(z.literal('')),
  specialties: z
    .array(z.string().min(1, 'Specialty cannot be empty'))
    .min(1, 'Please select at least one specialty'),
  timezone: z.string().min(1, 'Please select a timezone'),
  currency: z.string().refine((val) => SUPPORTED_CURRENCIES.some((c) => c.code === val), {
    message: 'Please select a valid currency',
  }),
  /** Optional reference hourly rate in DOLLARS — converted to cents before DB write */
  hourlyRate: z.number().min(0).optional().nullable(),
  /** Session types with price in DOLLARS */
  sessionTypes: z.array(apiSessionTypeSchema).min(1, 'At least one session type is required'),
  /** Optional avatar URL */
  avatarUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

function calculateProfileCompletion(data: z.infer<typeof patchProfileSchema>): number {
  let score = 0;

  const step1FieldWeight = 25 / 4;
  if (data.displayName && data.displayName.length >= 2) score += step1FieldWeight;
  if (data.headline && data.headline.length >= 10) score += step1FieldWeight;
  if (data.avatarUrl) score += step1FieldWeight;
  if (data.timezone) score += step1FieldWeight;

  const step2FieldWeight = 25 / 2;
  if (data.bio && data.bio.length > 0) score += step2FieldWeight;
  if (data.specialties && data.specialties.length > 0) score += step2FieldWeight;

  const step3FieldWeight = 25 / 2;
  if (data.currency) score += step3FieldWeight;
  if (data.sessionTypes && data.sessionTypes.length > 0) score += step3FieldWeight;

  // Bonus 25% for completing all prior steps
  if (score >= 75) score += 25;

  return Math.round(score);
}

/**
 * PATCH /api/coach-profile
 *
 * Updates the authenticated coach's profile. Mirrors `saveProfile` server action.
 *
 * Rate limit: 10 req/min
 *
 * @body {string} displayName - Coach display name (2-100 chars)
 * @body {string} headline - Professional tagline (10-150 chars)
 * @body {string} [bio] - Biography (max 2000 chars)
 * @body {string[]} specialties - At least one specialty tag
 * @body {string} timezone - IANA timezone (e.g. "America/New_York")
 * @body {string} currency - ISO 4217 code (USD|EUR|GBP|CAD|AUD|NZD|CHF|INR|JPY|SGD)
 * @body {number} [hourlyRate] - Reference hourly rate in dollars (stored as cents)
 * @body {Array} sessionTypes - Session offerings; price in dollars (stored as cents)
 * @body {string} [avatarUrl] - Avatar image URL
 *
 * @returns {{ success: true, data: { slug: string, profileCompletionPercentage: number } }}
 */
export async function PATCH(request: Request) {
  const rl = rateLimit(request, PROFILE_SAVE_LIMIT, 'coach-profile-patch');
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
    const parsed = patchProfileSchema.safeParse(body);

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

    const data = parsed.data;

    // Verify coach profile exists
    const existingProfiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (existingProfiles.length === 0) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Profile not found. Please complete onboarding first.',
          },
        },
        { status: 404 }
      );
    }

    const existingProfile = existingProfiles[0];

    // Generate new slug if name changed
    let slug = existingProfile.slug;
    const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const currentName = userRecords[0]?.name;

    if (currentName !== data.displayName) {
      const baseSlug = generateSlug(data.displayName);
      slug = baseSlug;

      let slugExists = true;
      let counter = 0;

      while (slugExists) {
        const existing = await db
          .select()
          .from(coachProfiles)
          .where(eq(coachProfiles.slug, slug))
          .limit(1);

        if (existing.length === 0 || existing[0].userId === userId) {
          slugExists = false;
        } else {
          counter++;
          slug = `${baseSlug}-${counter}`;
        }
      }
    }

    const completionPercentage = calculateProfileCompletion(data);

    // Update users table
    await db
      .update(users)
      .set({
        name: data.displayName,
        avatarUrl: data.avatarUrl || null,
      })
      .where(eq(users.id, userId));

    // Update coach profile — convert dollars to cents
    await db
      .update(coachProfiles)
      .set({
        slug,
        headline: data.headline,
        bio: data.bio || null,
        specialties: data.specialties,
        timezone: data.timezone,
        hourlyRate: data.hourlyRate != null ? Math.round(data.hourlyRate * 100) : null,
        currency: data.currency,
        sessionTypes: data.sessionTypes.map((st) => ({
          ...st,
          price: Math.round(st.price * 100), // dollars → cents
        })),
        profileCompletionPercentage: completionPercentage,
      })
      .where(eq(coachProfiles.userId, userId));

    return Response.json({
      success: true,
      data: { slug, profileCompletionPercentage: completionPercentage },
    });
  } catch (error) {
    console.error('Error saving coach profile:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save profile' } },
      { status: 500 }
    );
  }
}
