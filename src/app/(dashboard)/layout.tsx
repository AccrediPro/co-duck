import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { DashboardSidebar, DashboardMobileHeader } from '@/components/navigation';
import { ProfileCompletionBanner } from '@/components/dashboard/profile-completion-banner';
import { db, users, coachProfiles } from '@/db';
import { claimCoachInvite } from '@/lib/claim-invite';
import { getUnreadMessageCountForUser } from './dashboard/messages/actions';
import { getIConnectUnreadCountForUser } from './dashboard/iconnect/actions';

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
      // Check if existing client user has a pending coach invite
      // (webhook may have created user before invite was claimed)
      if (userRole === 'client' && userEmail) {
        const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null;
        const claimed = await claimCoachInvite(userId, userEmail, name);
        if (claimed) userRole = 'coach';
      }
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
        // Check if this new user has a pending coach invite
        if (email && userRole === 'client') {
          const claimed = await claimCoachInvite(userId, email, name);
          if (claimed) userRole = 'coach';
        }
      }
    }
  } catch (error) {
    console.error('[dashboard layout] DB sync error:', error);
    // Default to client if DB query fails
  }

  // For coaches, check profile completeness (for banner)
  let coachProfileData: { hasBio: boolean; hasSessionTypes: boolean; isPublished: boolean; profileExists: boolean } = {
    profileExists: false,
    hasBio: false,
    hasSessionTypes: false,
    isPublished: false,
  };
  if (userRole === 'coach') {
    try {
      const profiles = await db
        .select({
          bio: coachProfiles.bio,
          sessionTypes: coachProfiles.sessionTypes,
          isPublished: coachProfiles.isPublished,
        })
        .from(coachProfiles)
        .where(eq(coachProfiles.userId, userId))
        .limit(1);
      if (profiles.length > 0) {
        const p = profiles[0];
        coachProfileData = {
          profileExists: true,
          hasBio: !!p.bio && p.bio.trim().length > 0,
          hasSessionTypes: Array.isArray(p.sessionTypes) && p.sessionTypes.length > 0,
          isPublished: p.isPublished,
        };
      }
    } catch {
      // Default to incomplete if query fails
    }
  }

  // Fetch unread counts in parallel
  let unreadMessageCount = 0;
  let iconnectUnreadCount = 0;
  try {
    [unreadMessageCount, iconnectUnreadCount] = await Promise.all([
      getUnreadMessageCountForUser(userId),
      getIConnectUnreadCountForUser(userId),
    ]);
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
        iconnectUnreadCount={iconnectUnreadCount}
      />
      <div className="flex flex-1 flex-col">
        <DashboardMobileHeader
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          unreadMessageCount={unreadMessageCount}
          iconnectUnreadCount={iconnectUnreadCount}
        />
        <main className="flex-1 overflow-auto bg-cream p-4 md:p-8">
          {userRole === 'coach' && (
            <ProfileCompletionBanner
              profileExists={coachProfileData.profileExists}
              hasBio={coachProfileData.hasBio}
              hasSessionTypes={coachProfileData.hasSessionTypes}
              isPublished={coachProfileData.isPublished}
            />
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
