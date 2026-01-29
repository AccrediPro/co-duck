import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { DashboardSidebar, DashboardMobileHeader } from '@/components/navigation';
import { db, users } from '@/db';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await currentUser();
  const userName = user?.firstName || user?.username;
  const userEmail = user?.emailAddresses[0]?.emailAddress;

  // Fetch user role from database
  let userRole: 'admin' | 'coach' | 'client' = 'client';
  try {
    const dbUser = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (dbUser.length > 0 && dbUser[0].role) {
      userRole = dbUser[0].role;
    }
  } catch {
    // Default to client if DB query fails
  }

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar userName={userName} userEmail={userEmail} userRole={userRole} />
      <div className="flex flex-1 flex-col">
        <DashboardMobileHeader userName={userName} userEmail={userEmail} userRole={userRole} />
        <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
