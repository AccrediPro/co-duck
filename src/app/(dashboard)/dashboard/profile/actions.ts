'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles, users } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  coachBasicInfoSchema,
  coachBioSpecialtiesSchema,
  sessionTypeSchema,
  SUPPORTED_CURRENCIES,
  generateSlug,
  flattenSpecialties,
} from '@/lib/validators/coach-onboarding';

// Schema for the full profile update.
// Specialties uses the LEGACY flat `string[]` shape here — see the comment
// on `profileEditorSchema` in profile-editor-form.tsx for the rationale.
// The DB column accepts either shape during the 2-level taxonomy transition.
const fullProfileSchema = z.object({
  displayName: coachBasicInfoSchema.shape.displayName,
  headline: coachBasicInfoSchema.shape.headline,
  profilePhotoUrl: coachBasicInfoSchema.shape.profilePhotoUrl,
  timezone: coachBasicInfoSchema.shape.timezone,
  bio: coachBioSpecialtiesSchema.shape.bio,
  specialties: z
    .array(z.string().min(1, 'Specialty cannot be empty'))
    .min(1, 'Please select at least one specialty'),
  hourlyRate: z.number().min(0).optional().nullable(),
  currency: z.string().refine((val) => SUPPORTED_CURRENCIES.some((c) => c.code === val)),
  sessionTypes: z.array(sessionTypeSchema).min(1, 'At least one session type is required'),
});

export type FullProfileFormData = z.infer<typeof fullProfileSchema>;

export type SaveProfileResult = { success: true; slug: string } | { success: false; error: string };

export async function saveProfile(data: FullProfileFormData): Promise<SaveProfileResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be logged in to update your profile' };
    }

    // Validate input
    const validationResult = fullProfileSchema.safeParse(data);
    if (!validationResult.success) {
      return { success: false, error: validationResult.error.issues[0].message };
    }

    // Get existing profile
    const existingProfiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (existingProfiles.length === 0) {
      return { success: false, error: 'Profile not found. Please complete onboarding first.' };
    }

    const existingProfile = existingProfiles[0];

    // Generate new slug if name changed
    let slug = existingProfile.slug;
    const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const currentName = userRecords[0]?.name;

    if (currentName !== data.displayName) {
      // Generate base slug
      const baseSlug = generateSlug(data.displayName);
      slug = baseSlug;

      // Check for slug collisions (excluding current profile)
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

    // Calculate profile completion
    const completionPercentage = calculateProfileCompletion(data);

    // Update user table (name and avatar)
    await db
      .update(users)
      .set({
        name: data.displayName,
        avatarUrl: data.profilePhotoUrl || null,
      })
      .where(eq(users.id, userId));

    // Update coach profile
    await db
      .update(coachProfiles)
      .set({
        slug,
        headline: data.headline,
        bio: data.bio || null,
        specialties: data.specialties,
        timezone: data.timezone,
        hourlyRate: data.hourlyRate ? Math.round(data.hourlyRate * 100) : null,
        currency: data.currency,
        sessionTypes: data.sessionTypes.map((st) => ({
          ...st,
          price: Math.round(st.price * 100), // Convert to cents
        })),
        profileCompletionPercentage: completionPercentage,
      })
      .where(eq(coachProfiles.userId, userId));

    return { success: true, slug };
  } catch (error) {
    console.error('Error saving profile:', error);
    return { success: false, error: 'An error occurred while saving your profile' };
  }
}

function calculateProfileCompletion(data: FullProfileFormData): number {
  let score = 0;

  // Step 1 fields (25% total)
  const step1Weight = 25;
  const step1Fields = 4;
  const step1FieldWeight = step1Weight / step1Fields;

  if (data.displayName && data.displayName.length >= 2) score += step1FieldWeight;
  if (data.headline && data.headline.length >= 10) score += step1FieldWeight;
  if (data.profilePhotoUrl) score += step1FieldWeight;
  if (data.timezone) score += step1FieldWeight;

  // Step 2 fields (25% total)
  const step2Weight = 25;
  const step2Fields = 2;
  const step2FieldWeight = step2Weight / step2Fields;

  if (data.bio && data.bio.length > 0) score += step2FieldWeight;
  if (data.specialties && data.specialties.length > 0) score += step2FieldWeight;

  // Step 3 fields (25% total)
  const step3Weight = 25;
  const step3Fields = 2;
  const step3FieldWeight = step3Weight / step3Fields;

  if (data.currency) score += step3FieldWeight;
  if (data.sessionTypes && data.sessionTypes.length > 0) score += step3FieldWeight;

  // Profile editor = 25% bonus for having completed profile
  if (score >= 75) score += 25;

  return Math.round(score);
}

export type TogglePublishResult =
  | { success: true; isPublished: boolean }
  | { success: false; error: string };

export async function togglePublishProfile(publish: boolean): Promise<TogglePublishResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be logged in' };
    }

    await db
      .update(coachProfiles)
      .set({ isPublished: publish })
      .where(eq(coachProfiles.userId, userId));

    return { success: true, isPublished: publish };
  } catch (error) {
    console.error('Error toggling publish status:', error);
    return { success: false, error: 'Failed to update publish status' };
  }
}

export async function getFullProfile() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false as const, error: 'Not authenticated' };
    }

    // Get coach profile
    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false as const, error: 'Profile not found' };
    }

    // Get user data
    const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    const profile = profiles[0];
    const user = userRecords[0];

    return {
      success: true as const,
      profile: {
        displayName: user?.name || '',
        profilePhotoUrl: user?.avatarUrl || '',
        headline: profile.headline || '',
        bio: profile.bio || '',
        specialties: flattenSpecialties(profile.specialties),
        timezone: profile.timezone || '',
        hourlyRate: profile.hourlyRate ? profile.hourlyRate / 100 : null, // Convert from cents
        currency: profile.currency || 'USD',
        sessionTypes:
          profile.sessionTypes?.map((st) => ({
            ...st,
            price: st.price / 100, // Convert from cents
          })) || [],
        isPublished: profile.isPublished,
        profileCompletionPercentage: profile.profileCompletionPercentage,
        slug: profile.slug,
      },
    };
  } catch (error) {
    console.error('Error fetching profile:', error);
    return { success: false as const, error: 'Failed to load profile' };
  }
}
