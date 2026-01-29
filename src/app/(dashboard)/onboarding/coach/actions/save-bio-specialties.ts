'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles } from '@/db';
import { eq } from 'drizzle-orm';
import {
  coachBioSpecialtiesSchema,
  type CoachBioSpecialtiesFormData,
} from '@/lib/validators/coach-onboarding';

export type SaveBioSpecialtiesResult = { success: true } | { success: false; error: string };

export async function saveBioSpecialties(
  data: CoachBioSpecialtiesFormData
): Promise<SaveBioSpecialtiesResult> {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be logged in to complete onboarding' };
    }

    // Validate input
    const validationResult = coachBioSpecialtiesSchema.safeParse(data);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || 'Invalid input',
      };
    }

    const { bio, specialties } = validationResult.data;

    // Check if user has a coach profile (should exist from Step 1)
    const existingProfile = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (existingProfile.length === 0) {
      return {
        success: false,
        error: 'Please complete Step 1 first',
      };
    }

    // Calculate updated profile completion percentage
    const currentProfile = existingProfile[0];
    const completionPercentage = calculateCompletionPercentage(currentProfile, {
      bio,
      specialties,
    });

    // Update coach profile with bio and specialties
    await db
      .update(coachProfiles)
      .set({
        bio: bio || null,
        specialties,
        profileCompletionPercentage: completionPercentage,
      })
      .where(eq(coachProfiles.userId, userId));

    return { success: true };
  } catch (error) {
    console.error('Error saving bio and specialties:', error);
    return { success: false, error: 'An error occurred while saving your profile' };
  }
}

// Calculate profile completion percentage based on filled fields
function calculateCompletionPercentage(
  currentProfile: typeof coachProfiles.$inferSelect,
  step2Data: CoachBioSpecialtiesFormData
): number {
  // Step 1 contributes 25% when complete
  // Step 2 contributes 25% when complete
  // Each field contributes a portion of that step's weight

  let score = 0;

  // Step 1 fields (25% total)
  const step1Weight = 25;
  const step1Fields = 4;
  const step1FieldWeight = step1Weight / step1Fields;

  if (currentProfile.headline && currentProfile.headline.length >= 10) score += step1FieldWeight;
  if (currentProfile.timezone) score += step1FieldWeight;
  // displayName and avatarUrl are in users table, count as complete if profile exists
  score += step1FieldWeight * 2;

  // Step 2 fields (25% total)
  const step2Weight = 25;
  const step2Fields = 2;
  const step2FieldWeight = step2Weight / step2Fields;

  if (step2Data.bio && step2Data.bio.length > 0) score += step2FieldWeight;
  if (step2Data.specialties && step2Data.specialties.length > 0) score += step2FieldWeight;

  return Math.round(score);
}
