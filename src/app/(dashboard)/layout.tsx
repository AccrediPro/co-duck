import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { DashboardSidebar, DashboardMobileHeader } from '@/components/navigation';
import { db, users } from '@/db';
import { getUnreadMessageCountForUser } from './dashboard/messages/actions';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  let user = null;
  try {
    user = await currentUser();
  } catch (err) {
    console.error('Failed to fetch Clerk user:', err);
  }
  const userName = user?.firstName || user?.username;
  const userEmail = user?.emailAddresses[0]?.emailAddress;

  // Fetch user role from database, auto-sync from Clerk if not found
  let userRole: 'admin' | 'coach' | 'client' = 'client';
  try {
    const dbUser = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (dbUser.length > 0 && dbUser[0].role) {
      userRole = dbUser[0].role;
    } else if (dbUser.length === 0 && user) {
      // Auto-sync: Clerk user exists but not in DB yet (webhook may not have fired)
      const email = user.emailAddresses[0]?.emailAddress;
      if (email) {
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
        const [newUser] = await db
          .insert(users)
          .values({
            id: userId,
            email,
            name,
            avatarUrl: user.imageUrl || null,
            role: 'client',
          })
          .onConflictDoNothing()
          .returning();
        if (newUser?.role) {
          userRole = newUser.role;
        }
      }
    }
  } catch {
    // Default to client if DB query fails
  }

  // Fetch unread message count
  let unreadMessageCount = 0;
  try {
    unreadMessageCount = await getUnreadMessageCountForUser(userId);
  } catch {
    // Default to 0 if fetching fails
  }

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        unreadMessageCount={unreadMessageCount}
      />
      <div className="flex flex-1 flex-col">
        <DashboardMobileHeader
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          unreadMessageCount={unreadMessageCount}
        />
        <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
