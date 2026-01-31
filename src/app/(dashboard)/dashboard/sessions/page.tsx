/**
 * @fileoverview Coach Sessions Page - Session Management for Coaches
 *
 * This page displays a coach's sessions organized by status tabs (upcoming,
 * past, cancelled). It demonstrates the pattern of server-side data fetching
 * with client-side interactivity.
 *
 * ## Data Flow
 *
 * 1. Authenticate and verify user is a coach with completed profile
 * 2. Parse URL search params for tab and page number
 * 3. Fetch sessions via `getCoachSessions` server action during SSR
 * 4. Pass data to `SessionsList` client component for interactivity
 *
 * ## Access Control
 *
 * This page has multiple access checks:
 * - Must be authenticated → redirects to /sign-in
 * - Must have user record → redirects to /dashboard
 * - Must have coach role → shows "Become a Coach" message
 * - Must have coach profile → shows "Complete Onboarding" message
 *
 * ## URL Parameters
 *
 * | Param | Type   | Default   | Description                    |
 * |-------|--------|-----------|--------------------------------|
 * | tab   | string | 'upcoming'| Session filter: upcoming/past/cancelled |
 * | page  | string | '1'       | Pagination page number         |
 *
 * @module app/(dashboard)/dashboard/sessions/page
 * @see {@link SessionsList} - Client component for session list with tabs
 * @see {@link getCoachSessions} - Server action for fetching sessions
 */

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

/** Page metadata for SEO and browser tab */
/** Page metadata for SEO and browser tab */
export const metadata = {
  title: 'Sessions | Coaching Platform',
  description: 'Manage your coaching sessions',
};

/**
 * Props for the Sessions page component.
 *
 * Next.js 15 passes searchParams as a Promise that must be awaited.
 */
interface PageProps {
  searchParams: Promise<{ tab?: string; page?: string }>;
}

/**
 * Coach Sessions Page - Displays and manages coaching sessions.
 *
 * This is an async server component that:
 * 1. Verifies the user is an authenticated coach with a complete profile
 * 2. Parses and validates URL search params
 * 3. Fetches paginated session data
 * 4. Renders the SessionsList client component with initial data
 *
 * ## Error States
 *
 * The page handles several error states with appropriate UI:
 * - Not a coach → shows onboarding CTA
 * - No coach profile → shows complete onboarding CTA
 * - Session fetch error → shows error card with return link
 *
 * @param props.searchParams - URL search parameters (tab, page)
 * @returns The sessions page with appropriate content based on user state
 *
 * @example
 * ```
 * // URL: /dashboard/sessions?tab=past&page=2
 * // Shows page 2 of past sessions
 * ```
 */
export default async function SessionsPage({ searchParams }: PageProps) {
  // --------------------------------
  // AUTHENTICATION
  // --------------------------------
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // --------------------------------
  // ROLE VERIFICATION
  // --------------------------------

  // First check: user must exist in database
  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (userRecords.length === 0) {
    redirect('/dashboard');
  }

  const user = userRecords[0];

  // Second check: user must have coach role
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

  // Third check: coach must have completed onboarding (has profile)
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

  // --------------------------------
  // PARSE AND VALIDATE SEARCH PARAMS
  // --------------------------------

  // Await the Promise<searchParams> (Next.js 15 pattern)
  const params = await searchParams;

  // Parse tab parameter with validation
  const tab = (params.tab as SessionStatus) || 'upcoming';
  const validTabs: SessionStatus[] = ['upcoming', 'past', 'cancelled'];
  const validTab: SessionStatus = validTabs.includes(tab) ? tab : 'upcoming';

  // Parse pagination parameters
  const page = parseInt(params.page || '1', 10);
  const perPage = 10;

  // --------------------------------
  // FETCH SESSION DATA
  // --------------------------------

  // Server action call during SSR - data is fetched once
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

  // --------------------------------
  // RENDER SUCCESS STATE
  // --------------------------------

  // Pass SSR-fetched data to client component
  // SessionsList handles tab switching, pagination clicks, and session actions
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sessions</h1>
        <p className="text-muted-foreground">
          View and manage your coaching sessions. Mark sessions as complete or cancel upcoming ones.
        </p>
      </div>

      {/* Client component receives initial data and handles interactivity */}
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
