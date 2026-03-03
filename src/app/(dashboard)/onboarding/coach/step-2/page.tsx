import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, coachProfiles } from '@/db';
import { eq } from 'drizzle-orm';
import { StepIndicator, BioSpecialtiesForm } from '@/components/onboarding';

export const metadata = {
  title: 'Coach Onboarding - Step 2 | Coaching Platform',
  description: 'Set up your coach profile - Bio & Specialties',
};

export default async function CoachOnboardingStep2Page() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Check if user has a coach profile (from Step 1)
  const existingProfile = await db
    .select()
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  // If no profile exists, redirect to step 1
  if (existingProfile.length === 0) {
    redirect('/onboarding/coach');
  }

  const profile = existingProfile[0];
  const initialData = {
    bio: profile.bio,
    specialties: profile.specialties || [],
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-burgundy-dark">Coach Profile Setup</h1>
        <p className="mt-2 text-muted-foreground">
          Complete your profile to start connecting with clients
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={2} totalSteps={4} />

      {/* Form */}
      <BioSpecialtiesForm initialData={initialData} />
    </div>
  );
}
