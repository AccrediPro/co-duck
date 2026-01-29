import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, coachProfiles, users } from '@/db';
import { eq } from 'drizzle-orm';
import { StepIndicator, BasicInfoForm } from '@/components/onboarding';

export const metadata = {
  title: 'Coach Onboarding - Step 1 | Coaching Platform',
  description: 'Set up your coach profile - Basic Information',
};

export default async function CoachOnboardingStep1Page() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await currentUser();
  const userName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : null;

  // Check if user already has a coach profile with data
  const existingProfile = await db
    .select()
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  // Get user data for initial values
  const dbUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  const initialData = existingProfile[0]
    ? {
        displayName: dbUser[0]?.name || userName || '',
        headline: existingProfile[0].headline || '',
        profilePhotoUrl: dbUser[0]?.avatarUrl || '',
        timezone: existingProfile[0].timezone || '',
      }
    : {
        displayName: dbUser[0]?.name || userName || '',
        profilePhotoUrl: dbUser[0]?.avatarUrl || '',
      };

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
      <StepIndicator currentStep={1} totalSteps={4} />

      {/* Form */}
      <BasicInfoForm initialData={initialData} userName={userName} />
    </div>
  );
}
