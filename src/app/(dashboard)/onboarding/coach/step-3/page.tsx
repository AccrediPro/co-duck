import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { StepIndicator } from '@/components/onboarding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Coach Onboarding - Step 3 | Coaching Platform',
  description: 'Set up your coach profile - Pricing',
};

export default async function CoachOnboardingStep3Page() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
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
      <StepIndicator currentStep={3} totalSteps={4} />

      {/* Placeholder Content */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Set your hourly rate and session types.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-8 text-center">
            <p className="text-muted-foreground">
              Step 3 form coming soon. Your bio and specialties have been saved!
            </p>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" asChild>
              <Link href="/onboarding/coach/step-2">Back to Step 2</Link>
            </Button>
            <Button disabled>Continue to Step 4</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
