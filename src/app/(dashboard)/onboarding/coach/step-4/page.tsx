import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { StepIndicator, ReviewPublishForm } from '@/components/onboarding';
import { getCoachProfileForReview } from '../actions/publish-profile';

export const metadata = {
  title: 'Coach Onboarding - Step 4 | Coaching Platform',
  description: 'Set up your coach profile - Review & Publish',
};

export default async function CoachOnboardingStep4Page() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Get profile data for review
  const result = await getCoachProfileForReview();

  if (!result.success) {
    // If no profile exists, redirect to step 1
    redirect('/onboarding/coach');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">Become a Coach</h1>
        <p className="mt-2 text-muted-foreground">
          Complete your profile to start connecting with clients
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={4} totalSteps={4} />

      {/* Review Form */}
      <ReviewPublishForm
        profile={result.profile}
        missingItems={result.missingItems}
        completionPercentage={result.completionPercentage}
      />
    </div>
  );
}
