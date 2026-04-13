import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, users, coachProfiles } from '@/db';
import { AvailabilityForm } from '@/components/availability';
import { getAvailabilitySettings } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { User } from 'lucide-react';

export const metadata = {
  title: 'Availability Settings | Coaching Platform',
  description: 'Manage your coaching availability schedule',
};

export default async function AvailabilityPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Check if user is a coach
  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (userRecords.length === 0) {
    redirect('/dashboard');
  }

  const user = userRecords[0];

  // If not a coach, show appropriate message
  if (user.role !== 'coach') {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Availability</CardTitle>
            <CardDescription>Set your weekly coaching schedule</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Coach Access Required</CardTitle>
              <CardDescription>
                You need a coach account to set your availability. Please contact an administrator
                to get started.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  // Check if coach has completed onboarding
  const profiles = await db
    .select()
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  if (profiles.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Availability</CardTitle>
            <CardDescription>Set your weekly coaching schedule</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Onboarding</CardTitle>
              <CardDescription>
                You need to complete the coach onboarding before you can set your availability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/onboarding/coach">
                  <User className="mr-2 h-4 w-4" />
                  Complete Onboarding
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Get availability data
  const result = await getAvailabilitySettings();

  if (!result.success) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Availability</CardTitle>
            <CardDescription>Set your weekly coaching schedule</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Error Loading Availability</CardTitle>
              <CardDescription>{result.error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard">Return to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Availability</CardTitle>
          <CardDescription>Set your weekly coaching schedule</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        <AvailabilityForm initialData={result.data} />
      </div>
    </div>
  );
}
