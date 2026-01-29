import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, users, coachProfiles } from '@/db';
import { ProfileEditorForm } from '@/components/profile';
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

  // If not a coach, show appropriate message
  if (user.role !== 'coach') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile Editor</h1>
          <p className="text-muted-foreground">Manage your coach profile</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Become a Coach</CardTitle>
            <CardDescription>
              You need to be registered as a coach to access the profile editor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/onboarding/coach">
                <User className="mr-2 h-4 w-4" />
                Start Coach Onboarding
              </Link>
            </Button>
          </CardContent>
        </Card>
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile Editor</h1>
          <p className="text-muted-foreground">Manage your coach profile</p>
        </div>

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
    );
  }

  // Get full profile data
  const result = await getFullProfile();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile Editor</h1>
          <p className="text-muted-foreground">Manage your coach profile</p>
        </div>

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
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile Editor</h1>
        <p className="text-muted-foreground">
          Update your coach profile information. Changes are saved when you click Save.
        </p>
      </div>

      <ProfileEditorForm initialData={result.profile} />
    </div>
  );
}
