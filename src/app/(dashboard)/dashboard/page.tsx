import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db, users, coachProfiles } from '@/db';
import { User, Calendar, CheckCircle, Clock } from 'lucide-react';
import { getCoachDashboardData, getClientDashboardData } from './actions';
import { CoachDashboardLayout } from '@/components/dashboard/coach-dashboard-layout';
import { ClientDashboardLayout } from '@/components/dashboard/client-dashboard-layout';

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

  const clerkUser = await currentUser();
  const { user, coachProfile } = await getUserWithProfile(userId);

  const role = user?.role || 'client';
  const isCoach = role === 'coach';
  const displayName = clerkUser?.firstName || user?.name || 'User';

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
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
        </p>
      </div>

      {/* Coach Dashboard */}
      {isCoach && coachProfile && <CoachDashboardContent />}

      {/* Coach without profile - Onboarding prompt */}
      {isCoach && !coachProfile && <CoachOnboardingPrompt />}

      {/* Client Dashboard */}
      {role === 'client' && <ClientDashboardContent />}

      {/* Admin Dashboard */}
      {role === 'admin' && <AdminDashboard />}
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

  return <CoachDashboardLayout data={result.data} />;
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

  return <ClientDashboardLayout data={result.data} />;
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
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
        <CardHeader>
          <CardTitle className="text-amber-800 dark:text-amber-200">Admin Dashboard</CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-300">
            Full admin features including user management, analytics, and platform settings are
            coming soon.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
