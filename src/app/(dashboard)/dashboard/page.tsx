import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { db, users, coachProfiles } from '@/db';
import {
  User,
  Eye,
  Calendar,
  Pencil,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';

async function getUserWithProfile(userId: string) {
  // Get user from database
  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (userRecords.length === 0) {
    return { user: null, coachProfile: null };
  }

  const user = userRecords[0];

  // If user is a coach, get their profile
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

  // Determine the user's role
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
      {isCoach && coachProfile && <CoachDashboard profile={coachProfile} />}

      {/* Coach without profile - Onboarding prompt */}
      {isCoach && !coachProfile && <CoachOnboardingPrompt />}

      {/* Client Dashboard */}
      {role === 'client' && <ClientDashboard />}

      {/* Admin Dashboard */}
      {role === 'admin' && <AdminDashboard />}

      {/* Auth Debug Info */}
      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Authenticated User:</strong> You are signed in as{' '}
          <span className="font-medium">{clerkUser?.emailAddresses[0]?.emailAddress}</span>
        </p>
      </div>
    </div>
  );
}

// Coach Dashboard Component
function CoachDashboard({ profile }: { profile: typeof coachProfiles.$inferSelect }) {
  const isPublished = profile.isPublished;
  const completionPercentage = profile.profileCompletionPercentage;
  const publicProfileUrl = `/coaches/${profile.slug}`;

  return (
    <>
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Profile Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profile Status</CardTitle>
            {isPublished ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Clock className="h-4 w-4 text-amber-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={isPublished ? 'default' : 'secondary'}>
                {isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completion</span>
                <span className="font-medium">{completionPercentage}%</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              {completionPercentage < 100 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Complete your profile to attract more clients
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profile Views Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profile Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>Analytics coming soon</span>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Sessions Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Next 7 days</p>
            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>Booking coming soon</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your coaching profile</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard/profile">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={publicProfileUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Public Profile
            </a>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

// Coach Onboarding Prompt Component
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

// Client Dashboard Component
function ClientDashboard() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Upcoming Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No sessions scheduled</p>
            <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>Booking coming soon</span>
            </div>
          </CardContent>
        </Card>

        {/* Find a Coach */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Find a Coach</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Browse our directory of professional coaches
            </p>
            <Button variant="outline" className="mt-3" size="sm" asChild>
              <Link href="/coaches">Browse Coaches</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with your coaching journey</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/coaches">
              <User className="mr-2 h-4 w-4" />
              Find a Coach
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

// Admin Dashboard Component
function AdminDashboard() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Users */}
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

        {/* Active Coaches */}
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

        {/* Sessions */}
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

      {/* Admin Notice */}
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
