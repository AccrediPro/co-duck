import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { DashboardSidebar, DashboardMobileHeader } from '@/components/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await currentUser();
  const userName = user?.firstName || user?.username;
  const userEmail = user?.emailAddresses[0]?.emailAddress;

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar userName={userName} userEmail={userEmail} />
      <div className="flex flex-1 flex-col">
        <DashboardMobileHeader userName={userName} userEmail={userEmail} />
        <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
