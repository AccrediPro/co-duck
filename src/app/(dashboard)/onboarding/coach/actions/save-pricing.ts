'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles } from '@/db';
import { eq } from 'drizzle-orm';
import { coachPricingSchema, type CoachPricingFormData } from '@/lib/validators/coach-onboarding';
import type { SessionType } from '@/db/schema';

export type SavePricingResult = { success: true } | { success: false; error: string };

export async function savePricing(data: CoachPricingFormData): Promise<SavePricingResult> {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be logged in to complete onboarding' };
    }

    // Validate input
    const validationResult = coachPricingSchema.safeParse(data);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || 'Invalid input',
      };
    }

    const { hourlyRate, currency, sessionTypes } = validationResult.data;

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
      hourlyRate,
      currency,
      sessionTypes,
    });

    // Convert session types to database format
    const sessionTypesForDb: SessionType[] = sessionTypes.map((st) => ({
      id: st.id,
      name: st.name,
      duration: st.duration,
      price: st.price,
    }));

    // Update coach profile with pricing data
    await db
      .update(coachProfiles)
      .set({
        hourlyRate: hourlyRate ?? null,
        currency,
        sessionTypes: sessionTypesForDb,
        profileCompletionPercentage: completionPercentage,
      })
      .where(eq(coachProfiles.userId, userId));

    return { success: true };
  } catch (error) {
    console.error('Error saving pricing:', error);
    return { success: false, error: 'An error occurred while saving your profile' };
  }
}

// Calculate profile completion percentage based on filled fields
function calculateCompletionPercentage(
  currentProfile: typeof coachProfiles.$inferSelect,
  step3Data: CoachPricingFormData
): number {
  // Step 1 contributes 25% when complete
  // Step 2 contributes 25% when complete
  // Step 3 contributes 25% when complete
  // Step 4 (review/publish) contributes 25%

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

  if (currentProfile.bio && currentProfile.bio.length > 0) score += step2FieldWeight;
  if (currentProfile.specialties && currentProfile.specialties.length > 0)
    score += step2FieldWeight;

  // Step 3 fields (25% total)
  const step3Weight = 25;
  const step3Fields = 2; // currency and sessionTypes (hourlyRate is optional)
  const step3FieldWeight = step3Weight / step3Fields;

  if (step3Data.currency) score += step3FieldWeight;
  if (step3Data.sessionTypes && step3Data.sessionTypes.length > 0) score += step3FieldWeight;

  return Math.round(score);
}
