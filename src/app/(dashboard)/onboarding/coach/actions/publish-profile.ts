'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles, users } from '@/db';
import { eq } from 'drizzle-orm';

export type PublishProfileResult =
  | { success: true; isPublished: boolean }
  | { success: false; error: string };

export async function publishProfile(publish: boolean): Promise<PublishProfileResult> {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be logged in to complete onboarding' };
    }

    // Check if user has a coach profile
    const existingProfile = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (existingProfile.length === 0) {
      return {
        success: false,
        error: 'Please complete the onboarding steps first',
      };
    }

    // Calculate final completion percentage (100% when all steps done and reviewing)
    const profile = existingProfile[0];
    const completionPercentage = calculateFinalCompletionPercentage(profile);

    // Update coach profile
    await db
      .update(coachProfiles)
      .set({
        isPublished: publish,
        profileCompletionPercentage: completionPercentage,
      })
      .where(eq(coachProfiles.userId, userId));

    return { success: true, isPublished: publish };
  } catch (error) {
    console.error('Error publishing profile:', error);
    return { success: false, error: 'An error occurred while updating your profile' };
  }
}

// Calculate the full profile completion percentage
function calculateFinalCompletionPercentage(profile: typeof coachProfiles.$inferSelect): number {
  let score = 0;

  // Step 1 fields (25% total)
  const step1Weight = 25;
  const step1Fields = 4;
  const step1FieldWeight = step1Weight / step1Fields;

  if (profile.headline && profile.headline.length >= 10) score += step1FieldWeight;
  if (profile.timezone) score += step1FieldWeight;
  // displayName and avatarUrl are in users table, count as complete if profile exists
  score += step1FieldWeight * 2;

  // Step 2 fields (25% total)
  const step2Weight = 25;
  const step2Fields = 2;
  const step2FieldWeight = step2Weight / step2Fields;

  if (profile.bio && profile.bio.length > 0) score += step2FieldWeight;
  if (profile.specialties && profile.specialties.length > 0) score += step2FieldWeight;

  // Step 3 fields (25% total)
  const step3Weight = 25;
  const step3Fields = 2;
  const step3FieldWeight = step3Weight / step3Fields;

  if (profile.currency) score += step3FieldWeight;
  if (profile.sessionTypes && profile.sessionTypes.length > 0) score += step3FieldWeight;

  // Step 4 (review) contributes 25% when reached
  score += 25;

  return Math.round(score);
}

// Get coach profile data for review
export async function getCoachProfileForReview() {
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

    // Get user data for name and avatar
    const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    const profile = profiles[0];
    const user = userRecords[0];

    // Calculate what's missing
    const missingItems: string[] = [];

    // Step 1 fields
    if (!user?.name) missingItems.push('Display name');
    if (!profile.headline || profile.headline.length < 10) missingItems.push('Headline');
    if (!user?.avatarUrl) missingItems.push('Profile photo');
    if (!profile.timezone) missingItems.push('Timezone');

    // Step 2 fields
    if (!profile.bio || profile.bio.length === 0) missingItems.push('Bio');
    if (!profile.specialties || profile.specialties.length === 0) missingItems.push('Specialties');

    // Step 3 fields
    if (!profile.sessionTypes || profile.sessionTypes.length === 0)
      missingItems.push('Session types');

    // Calculate completion percentage
    const completionPercentage = calculateCompletionPercentageForReview(profile, user);

    return {
      success: true as const,
      profile: {
        ...profile,
        displayName: user?.name || '',
        avatarUrl: user?.avatarUrl || null,
      },
      missingItems,
      completionPercentage,
    };
  } catch (error) {
    console.error('Error fetching profile for review:', error);
    return { success: false as const, error: 'Failed to load profile' };
  }
}

function calculateCompletionPercentageForReview(
  profile: typeof coachProfiles.$inferSelect,
  user: typeof users.$inferSelect | undefined
): number {
  let score = 0;

  // Step 1 fields (25% total)
  const step1Weight = 25;
  const step1Fields = 4;
  const step1FieldWeight = step1Weight / step1Fields;

  if (user?.name && user.name.length >= 2) score += step1FieldWeight;
  if (profile.headline && profile.headline.length >= 10) score += step1FieldWeight;
  if (user?.avatarUrl) score += step1FieldWeight;
  if (profile.timezone) score += step1FieldWeight;

  // Step 2 fields (25% total)
  const step2Weight = 25;
  const step2Fields = 2;
  const step2FieldWeight = step2Weight / step2Fields;

  if (profile.bio && profile.bio.length > 0) score += step2FieldWeight;
  if (profile.specialties && profile.specialties.length > 0) score += step2FieldWeight;

  // Step 3 fields (25% total)
  const step3Weight = 25;
  const step3Fields = 2;
  const step3FieldWeight = step3Weight / step3Fields;

  if (profile.currency) score += step3FieldWeight;
  if (profile.sessionTypes && profile.sessionTypes.length > 0) score += step3FieldWeight;

  // Step 4 (review) contributes 25% when all other steps are complete
  if (score === 75) score += 25;

  return Math.round(score);
}
