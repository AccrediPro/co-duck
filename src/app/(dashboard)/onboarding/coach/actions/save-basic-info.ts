'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles, users } from '@/db';
import { eq } from 'drizzle-orm';
import {
  coachBasicInfoSchema,
  generateSlug,
  type CoachBasicInfoFormData,
} from '@/lib/validators/coach-onboarding';

export type SaveBasicInfoResult =
  | { success: true; slug: string }
  | { success: false; error: string };

export async function saveBasicInfo(data: CoachBasicInfoFormData): Promise<SaveBasicInfoResult> {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be logged in to complete onboarding' };
    }

    // Validate input
    const validationResult = coachBasicInfoSchema.safeParse(data);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || 'Invalid input',
      };
    }

    const { displayName, headline, profilePhotoUrl, timezone } = validationResult.data;

    // Generate slug from display name
    let slug = generateSlug(displayName);

    // Check if slug already exists and append random suffix if needed
    const existingProfile = await db
      .select({ slug: coachProfiles.slug })
      .from(coachProfiles)
      .where(eq(coachProfiles.slug, slug))
      .limit(1);

    if (existingProfile.length > 0) {
      // Append random suffix to make unique
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      slug = `${slug}-${randomSuffix}`;
    }

    // Check if user already has a coach profile
    const existingUserProfile = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (existingUserProfile.length > 0) {
      // Update existing profile
      await db
        .update(coachProfiles)
        .set({
          headline,
          timezone,
          profileCompletionPercentage: calculateCompletionPercentage({
            displayName,
            headline,
            profilePhotoUrl,
            timezone,
          }),
        })
        .where(eq(coachProfiles.userId, userId));

      // Update user's name and avatar
      await db
        .update(users)
        .set({
          name: displayName,
          avatarUrl: profilePhotoUrl || null,
        })
        .where(eq(users.id, userId));

      return { success: true, slug: existingUserProfile[0].slug };
    } else {
      // Create new coach profile
      await db.insert(coachProfiles).values({
        userId,
        slug,
        headline,
        timezone,
        profileCompletionPercentage: calculateCompletionPercentage({
          displayName,
          headline,
          profilePhotoUrl,
          timezone,
        }),
      });

      // Update user's name, avatar, and role
      await db
        .update(users)
        .set({
          name: displayName,
          avatarUrl: profilePhotoUrl || null,
          role: 'coach',
        })
        .where(eq(users.id, userId));

      return { success: true, slug };
    }
  } catch (error) {
    console.error('Error saving basic info:', error);
    return { success: false, error: 'An error occurred while saving your profile' };
  }
}

// Calculate profile completion percentage based on filled fields
function calculateCompletionPercentage(data: CoachBasicInfoFormData): number {
  // Step 1 contributes 25% when complete
  // Each field contributes a portion of that 25%
  let score = 0;
  const fieldsPerStep = 4;
  const stepWeight = 25;
  const fieldWeight = stepWeight / fieldsPerStep;

  if (data.displayName && data.displayName.length >= 2) score += fieldWeight;
  if (data.headline && data.headline.length >= 10) score += fieldWeight;
  if (data.profilePhotoUrl && data.profilePhotoUrl.length > 0) score += fieldWeight;
  if (data.timezone) score += fieldWeight;

  return Math.round(score);
}
