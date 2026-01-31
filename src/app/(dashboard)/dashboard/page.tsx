/**
 * @fileoverview Main Dashboard Page - Role-Based Entry Point
 *
 * This is the primary dashboard landing page that displays role-specific content
 * based on the authenticated user's role (coach, client, or admin).
 *
 * ## Data Flow
 *
 * 1. Authenticate via Clerk (`auth()` and `currentUser()`)
 * 2. Fetch user record from database to determine role
 * 3. If coach, also fetch their coach profile
 * 4. Render role-specific dashboard component:
 *    - Coach with profile → `CoachDashboard`
 *    - Coach without profile → `CoachOnboardingPrompt`
 *    - Client → `ClientDashboard` (fetches action items count)
 *    - Admin → `AdminDashboard`
 *
 * ## Dashboard Components
 *
 * | Component              | Role   | Description                        |
 * |------------------------|--------|------------------------------------|
 * | CoachDashboard         | coach  | Profile status, stats, quick actions |
 * | CoachOnboardingPrompt  | coach  | CTA to complete onboarding         |
 * | ClientDashboard        | client | Sessions, action items, find coach |
 * | AdminDashboard         | admin  | Platform stats (placeholder)       |
 *
 * ## Related Files
 *
 * - `src/db/schema.ts` - Database schema for users and coach_profiles
 * - `src/app/(dashboard)/dashboard/action-items/actions.ts` - Action items server actions
 * - `src/app/onboarding/coach/page.tsx` - Coach onboarding flow
 *
 * @module app/(dashboard)/dashboard/page
 * @see {@link CoachDashboard} - Coach-specific dashboard
 * @see {@link ClientDashboard} - Client-specific dashboard
 */

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
  CheckSquare,
  ArrowRight,
} from 'lucide-react';
import { getPendingActionItemsCount } from '@/app/(dashboard)/dashboard/action-items/actions';

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches the user record and their coach profile (if applicable).
 *
 * This is a server-side helper function that consolidates the two database
 * queries needed to render the dashboard. It's not a server action because
 * it's only called during server-side rendering.
 *
 * @param userId - The Clerk user ID (from `auth()`)
 * @returns Object containing user record and optional coach profile
 *
 * @example
 * ```ts
 * const { user, coachProfile } = await getUserWithProfile(userId);
 * if (user?.role === 'coach' && coachProfile) {
 *   // Render coach dashboard
 * }
 * ```
 */
async function getUserWithProfile(userId: string) {
  // Get user from database - Clerk user ID is used as primary key
  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (userRecords.length === 0) {
    return { user: null, coachProfile: null };
  }

  const user = userRecords[0];

  // If user is a coach, also fetch their profile
  // Coach profile may not exist if they haven't completed onboarding
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

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

/**
 * Main Dashboard Page - Role-based entry point for authenticated users.
 *
 * This is an async server component that:
 * 1. Verifies authentication via Clerk
 * 2. Fetches user data to determine role
 * 3. Renders the appropriate dashboard based on role
 *
 * ## Authentication
 *
 * - Requires Clerk authentication
 * - Redirects to `/sign-in` if not authenticated
 * - Uses both `auth()` for userId and `currentUser()` for display name
 *
 * ## Role Detection
 *
 * The user's role is stored in the database (not Clerk) and determines
 * which dashboard to render. Default role for new users is 'client'.
 *
 * @returns The role-specific dashboard page
 *
 * @example
 * ```
 * // URL: /dashboard
 * // Renders one of:
 * // - CoachDashboard (for coaches with profile)
 * // - CoachOnboardingPrompt (for coaches without profile)
 * // - ClientDashboard (for clients)
 * // - AdminDashboard (for admins)
 * ```
 */
export default async function DashboardPage() {
  // Authentication: get user ID from Clerk session
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Fetch both Clerk user (for display name) and database user (for role)
  const clerkUser = await currentUser();
  const { user, coachProfile } = await getUserWithProfile(userId);

  // Determine role - defaults to 'client' if user record doesn't exist
  // (edge case: Clerk user exists but webhook hasn't created DB record yet)
  const role = user?.role || 'client';
  const isCoach = role === 'coach';

  // Display name priority: Clerk firstName > DB name > fallback
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

// ============================================================================
// ROLE-SPECIFIC DASHBOARD COMPONENTS
// ============================================================================

/**
 * Coach Dashboard - Displays profile status and management tools.
 *
 * Shows coaches their:
 * - Profile publication status (published/draft) with completion percentage
 * - Profile views (placeholder - analytics coming soon)
 * - Upcoming sessions count (placeholder - coming soon)
 * - Quick actions (edit profile, view public profile)
 *
 * @param props.profile - The coach's profile record from coach_profiles table
 * @returns Coach-specific dashboard with stats and quick actions
 *
 * @example
 * ```tsx
 * <CoachDashboard profile={coachProfile} />
 * ```
 */
function CoachDashboard({ profile }: { profile: typeof coachProfiles.$inferSelect }) {
  // Profile status indicators
  const isPublished = profile.isPublished;
  const completionPercentage = profile.profileCompletionPercentage;

  // Public profile URL for external link button
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

/**
 * Coach Onboarding Prompt - Shown to coaches who haven't completed onboarding.
 *
 * This component is displayed when a user has the 'coach' role but no
 * corresponding record in the coach_profiles table. This happens when:
 * - An admin assigns the coach role but they haven't completed setup
 * - The coach started onboarding but didn't finish
 *
 * @returns Call-to-action card linking to coach onboarding flow
 */
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

/**
 * Client Dashboard - Main dashboard for clients (non-coaches).
 *
 * This is an async server component that fetches and displays:
 * - Upcoming sessions count (placeholder - coming soon)
 * - Pending action items count (fetched from server action)
 * - Quick actions (find coach, view action items)
 *
 * ## Data Fetching Pattern
 *
 * Uses `getPendingActionItemsCount()` server action to fetch the count
 * directly during server-side rendering. The result is handled gracefully:
 * - On success: displays the count
 * - On error: displays 0 (silent failure for better UX)
 *
 * @returns Client-specific dashboard with session info and action items
 *
 * @example
 * ```tsx
 * // Rendered for users with role === 'client'
 * <ClientDashboard />
 * ```
 */
async function ClientDashboard() {
  // Fetch pending action items count via server action
  // This is called during SSR, not from a client component
  const actionItemsResult = await getPendingActionItemsCount();

  // Graceful fallback: show 0 if fetch fails
  const pendingActionItems = actionItemsResult.success ? actionItemsResult.count || 0 : 0;

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

        {/* Action Items Widget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Action Items</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingActionItems}</div>
            <p className="text-xs text-muted-foreground">
              {pendingActionItems === 1 ? 'pending item' : 'pending items'}
            </p>
            <Button variant="outline" className="mt-3" size="sm" asChild>
              <Link href="/dashboard/action-items" className="flex items-center gap-1">
                View All
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
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
          <Button variant="outline" asChild>
            <Link href="/dashboard/action-items">
              <CheckSquare className="mr-2 h-4 w-4" />
              View Action Items
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

/**
 * Admin Dashboard - Platform administration dashboard (placeholder).
 *
 * Currently displays placeholder cards for:
 * - Total users count
 * - Active coaches count (published profiles)
 * - Total sessions booked
 *
 * Full admin features including user management, analytics, and platform
 * settings are planned for future development.
 *
 * @returns Admin-specific dashboard with platform stats (placeholder)
 */
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
