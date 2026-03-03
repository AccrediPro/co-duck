import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, users, coachProfiles } from '@/db';
import { ProfileEditorForm } from '@/components/profile';
import { ClientProfileForm } from '@/components/settings/client-profile-form';
import { getFullProfile } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { User } from 'lucide-react';

export const metadata = {
  title: 'Edit Profile | Coaching Platform',
  description: 'Edit your coach profile',
};

export default async function ProfilePage() {
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

  // If not a coach, show client profile form
  if (user.role !== 'coach') {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">My Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <ClientProfileForm />
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
            <CardTitle className="text-2xl font-bold">Profile Editor</CardTitle>
            <CardDescription>Manage your public coach profile</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Onboarding</CardTitle>
              <CardDescription>
                You need to complete the coach onboarding before you can edit your profile.
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

  // Get full profile data
  const result = await getFullProfile();

  if (!result.success) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Profile Editor</CardTitle>
            <CardDescription>Manage your public coach profile</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Error Loading Profile</CardTitle>
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
          <CardTitle className="text-2xl font-bold">Profile Editor</CardTitle>
          <CardDescription>Manage your public coach profile</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        <ProfileEditorForm initialData={result.profile} />
      </div>
    </div>
  );
}
