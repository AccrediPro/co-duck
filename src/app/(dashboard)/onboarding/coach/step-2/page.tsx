import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { StepIndicator } from '@/components/onboarding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Coach Onboarding - Step 2 | Coaching Platform',
  description: 'Set up your coach profile - Bio & Specialties',
};

export default async function CoachOnboardingStep2Page() {
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
      <StepIndicator currentStep={2} totalSteps={4} />

      {/* Placeholder Content */}
      <Card>
        <CardHeader>
          <CardTitle>Bio & Specialties</CardTitle>
          <CardDescription>
            Tell potential clients about yourself and your areas of expertise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-8 text-center">
            <p className="text-muted-foreground">
              Step 2 form coming soon. Your basic info has been saved!
            </p>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" asChild>
              <Link href="/onboarding/coach">Back to Step 1</Link>
            </Button>
            <Button disabled>Continue to Step 3</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
