import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, users, coachProfiles } from '@/db';
import { SessionsList } from '@/components/sessions';
import { getCoachSessions, type SessionStatus } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { User } from 'lucide-react';

export const metadata = {
  title: 'Sessions | Coaching Platform',
  description: 'Manage your coaching sessions',
};

interface PageProps {
  searchParams: Promise<{ tab?: string; page?: string }>;
}

export default async function SessionsPage({ searchParams }: PageProps) {
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
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">Manage your coaching sessions</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Become a Coach</CardTitle>
            <CardDescription>
              You need to be registered as a coach to view your sessions.
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
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">Manage your coaching sessions</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Complete Your Onboarding</CardTitle>
            <CardDescription>
              You need to complete the coach onboarding before you can manage sessions.
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

  // Parse search params
  const params = await searchParams;
  const tab = (params.tab as SessionStatus) || 'upcoming';
  const page = parseInt(params.page || '1', 10);
  const perPage = 10;

  // Validate tab
  const validTabs: SessionStatus[] = ['upcoming', 'past', 'cancelled'];
  const validTab: SessionStatus = validTabs.includes(tab) ? tab : 'upcoming';

  // Get sessions data
  const result = await getCoachSessions(validTab, page, perPage);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">Manage your coaching sessions</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Error Loading Sessions</CardTitle>
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
        <h1 className="text-3xl font-bold">Sessions</h1>
        <p className="text-muted-foreground">
          View and manage your coaching sessions. Mark sessions as complete or cancel upcoming ones.
        </p>
      </div>

      <SessionsList
        initialTab={validTab}
        initialSessions={result.sessions || []}
        initialTotalCount={result.totalCount || 0}
        currentPage={page}
        perPage={perPage}
      />
    </div>
  );
}
