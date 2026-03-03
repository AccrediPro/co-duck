import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { AdminSidebar, AdminMobileHeader } from '@/components/navigation';
import { db, users } from '@/db';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

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

  // Only admins can access the admin dashboard
  if (userRole !== 'admin') {
    redirect('/dashboard');
  }

  const user = await currentUser();
  const userName = user?.firstName || user?.username;
  const userEmail = user?.emailAddresses[0]?.emailAddress;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userName={userName} userEmail={userEmail} />
      <div className="flex flex-1 flex-col">
        <AdminMobileHeader userName={userName} userEmail={userEmail} />
        <main className="flex-1 overflow-auto bg-cream p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
