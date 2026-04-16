import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, coachProfiles } from '@/db';
import { eq } from 'drizzle-orm';
import { StepIndicator, CredentialsEditor } from '@/components/onboarding';
import { saveCredentials } from '../actions/save-credentials';

export const metadata = {
  title: 'Coach Onboarding - Credentials | Coaching Platform',
  description: 'Set up your coach profile - Credentials & Training',
};

export default async function CoachOnboardingCredentialsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const existingProfile = await db
    .select({ userId: coachProfiles.userId, credentials: coachProfiles.credentials })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  if (existingProfile.length === 0) {
    redirect('/onboarding/coach');
  }

  const profile = existingProfile[0];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-burgundy-dark">Coach Profile Setup</h1>
        <p className="mt-2 text-muted-foreground">
          Complete your profile to start connecting with clients
        </p>
      </div>

      {/* Step 3 of 5 in the expanded flow */}
      <StepIndicator currentStep={3} totalSteps={5} />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Credentials & Training</h2>
        <p className="text-sm text-muted-foreground">
          Add your certifications, degrees, licenses, and memberships. This builds trust with
          potential clients and helps you stand out. You can skip this step and add credentials
          later from your profile settings.
        </p>
      </div>

      <CredentialsEditor
        initialCredentials={(profile.credentials as NonNullable<typeof profile.credentials>) ?? []}
        onSave={saveCredentials}
        submitLabel="Save & Continue to Pricing"
        nextPath="/onboarding/coach/step-3"
      />

      <div className="text-center">
        <a
          href="/onboarding/coach/step-3"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Skip for now
        </a>
      </div>
    </div>
  );
}
