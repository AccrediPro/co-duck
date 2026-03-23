import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db, users, coachProfiles } from '@/db';
import { User, Calendar, CheckCircle } from 'lucide-react';
import { getCoachDashboardData, getClientDashboardData } from './actions';
import { CoachDashboardLayout } from '@/components/dashboard/coach-dashboard-layout';
import { ClientDashboardLayout } from '@/components/dashboard/client-dashboard-layout';
import { StreakWidget } from '@/components/streaks/streak-widget';
import { StreakHistory } from '@/components/streaks/streak-history';
import { CheckInPrompt } from '@/components/check-ins/check-in-prompt';
import { CheckInOverview } from '@/components/check-ins/check-in-overview';
import { SessionPrepCard } from '@/components/session-prep/session-prep-card';

async function getUserWithProfile(userId: string) {
  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (userRecords.length === 0) {
    return { user: null, coachProfile: null };
  }

  const user = userRecords[0];

  let coachProfile = null;
  if (user.role === 'coach') {
    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);
    coachProfile = profiles[0] || null;
  }

  return { user, coachProfile };
}

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  let clerkUser = null;
  try {
    clerkUser = await currentUser();
  } catch (err) {
    console.error('Failed to fetch Clerk user:', err);
  }
  const { user, coachProfile } = await getUserWithProfile(userId);

  const role = user?.role || 'client';
  const isCoach = role === 'coach';
  const displayName = clerkUser?.firstName || user?.name || 'User';

  return (
    <div className="mx-auto max-w-5xl">
      {/* Page Header Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Dashboard</CardTitle>
          <CardDescription>
            Welcome back, {displayName}!
            {isCoach && (
              <Badge variant="secondary" className="ml-2">
                Coach
              </Badge>
            )}
            {role === 'client' && (
              <Badge variant="outline" className="ml-2">
                Client
              </Badge>
            )}
            {role === 'admin' && (
              <Badge variant="default" className="ml-2">
                Admin
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {/* Coach Dashboard */}
        {isCoach && coachProfile && <CoachDashboardContent />}

        {/* Coach without profile - Onboarding prompt */}
        {isCoach && !coachProfile && <CoachOnboardingPrompt />}

        {/* Client Dashboard */}
        {role === 'client' && <ClientDashboardContent />}

        {/* Admin Dashboard */}
        {role === 'admin' && <AdminDashboard />}
      </div>
    </div>
  );
}

async function CoachDashboardContent() {
  const result = await getCoachDashboardData();

  if (!result.success) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">Failed to load dashboard data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <CheckInOverview />
      <CoachDashboardLayout data={result.data} />
    </>
  );
}

async function ClientDashboardContent() {
  const result = await getClientDashboardData();

  if (!result.success) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">Failed to load dashboard data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <CheckInPrompt />
      <SessionPrepCard />
      <div className="grid gap-4 md:grid-cols-2">
        <StreakWidget />
        <StreakHistory />
      </div>
      <ClientDashboardLayout data={result.data} />
    </>
  );
}

function CoachOnboardingPrompt() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Complete Your Coach Profile</CardTitle>
        <CardDescription>
          Set up your profile to start accepting clients and grow your coaching business.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/onboarding/coach">
            <User className="mr-2 h-4 w-4" />
            Start Onboarding
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Admin stats coming soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coaches</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Published profiles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Total booked</p>
          </CardContent>
        </Card>
      </div>
      <Card className="border-gold/30 bg-gold/5 dark:border-gold-dark dark:bg-gold-dark/10">
        <CardHeader>
          <CardTitle className="text-burgundy-dark dark:text-gold">Admin Dashboard</CardTitle>
          <CardDescription className="text-burgundy dark:text-gold/80">
            Full admin features including user management, analytics, and platform settings are
            coming soon.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
