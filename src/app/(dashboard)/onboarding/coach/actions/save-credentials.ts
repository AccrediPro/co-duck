'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles } from '@/db';
import { eq } from 'drizzle-orm';
import {
  coachCredentialsSchema,
  type CoachCredentialsFormData,
} from '@/lib/validators/coach-onboarding';
import type { Credential } from '@/db/schema';

export type SaveCredentialsResult = { success: true } | { success: false; error: string };

export async function saveCredentials(
  data: CoachCredentialsFormData
): Promise<SaveCredentialsResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be logged in to complete onboarding' };
    }

    const validationResult = coachCredentialsSchema.safeParse(data);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || 'Invalid input',
      };
    }

    const { credentials } = validationResult.data;

    const existingProfile = await db
      .select({ userId: coachProfiles.userId })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (existingProfile.length === 0) {
      return { success: false, error: 'Please complete Step 1 first' };
    }

    // Strip admin-only fields (verifiedAt, verifiedBy) so coaches cannot self-verify
    const sanitizedCredentials: Credential[] = credentials.map(
      ({ verifiedAt: _va, verifiedBy: _vb, ...rest }) => rest as Credential
    );

    await db
      .update(coachProfiles)
      .set({ credentials: sanitizedCredentials })
      .where(eq(coachProfiles.userId, userId));

    return { success: true };
  } catch (error) {
    console.error('Error saving credentials:', error);
    return { success: false, error: 'An error occurred while saving your credentials' };
  }
}
