/**
 * @fileoverview Messages Page - Conversation List View
 *
 * This page displays all conversations for the authenticated user. Both
 * coaches and clients use this page, with the UI adapting based on role.
 *
 * ## Data Flow
 *
 * 1. Authenticate and verify user exists in database
 * 2. Fetch conversations via `getConversations` server action during SSR
 * 3. Pass data to `ConversationsList` client component
 *
 * ## Role-Based Differences
 *
 * | Aspect      | Coach                        | Client                     |
 * |-------------|------------------------------|----------------------------|
 * | Subtitle    | "Your conversations with clients" | "Your conversations with coaches" |
 * | List items  | Shows client names           | Shows coach names          |
 *
 * ## Related Files
 *
 * - `src/app/(dashboard)/dashboard/messages/actions.ts` - Server actions for conversation list
 * - `src/app/(dashboard)/dashboard/messages/[id]/page.tsx` - Individual chat view
 * - `src/components/messages/` - UI components for messaging
 *
 * @module app/(dashboard)/dashboard/messages/page
 * @see {@link ConversationsList} - Client component for conversation list
 * @see {@link getConversations} - Server action for fetching conversations
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, users } from '@/db';
import { ConversationsList } from '@/components/messages';
import { getConversations } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/** Page metadata for SEO and browser tab */
/** Page metadata for SEO and browser tab */
export const metadata = {
  title: 'Messages | Coaching Platform',
  description: 'Your conversations with coaches and clients',
};

/**
 * Messages Page - Displays all conversations for the authenticated user.
 *
 * This is an async server component that:
 * 1. Verifies the user is authenticated and exists in the database
 * 2. Fetches all conversations for the user
 * 3. Renders the ConversationsList client component with initial data
 *
 * The page works for both coaches and clients - the UI description
 * adapts based on the user's role.
 *
 * @returns The messages page with conversation list
 *
 * @example
 * ```
 * // URL: /dashboard/messages
 * // Shows list of all conversations with unread indicators
 * ```
 */
export default async function MessagesPage() {
  // --------------------------------
  // AUTHENTICATION
  // --------------------------------
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // --------------------------------
  // USER VERIFICATION
  // --------------------------------

  // Verify user exists in database (should exist via Clerk webhook sync)
  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (userRecords.length === 0) {
    redirect('/dashboard');
  }

  // --------------------------------
  // FETCH CONVERSATIONS
  // --------------------------------

  // Server action call during SSR - fetches all conversations
  const result = await getConversations();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Your conversations</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Error Loading Messages</CardTitle>
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

  // Determine role-specific description text
  const userRole = userRecords[0].role;
  const otherPartyLabel = userRole === 'coach' ? 'clients' : 'coaches';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="text-muted-foreground">Your conversations with {otherPartyLabel}</p>
      </div>

      {/* Client component handles conversation selection and navigation */}
      <ConversationsList initialConversations={result.conversations || []} userRole={userRole} />
    </div>
  );
}
