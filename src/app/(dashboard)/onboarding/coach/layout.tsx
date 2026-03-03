import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, users } from '@/db';

export default async function CoachOnboardingLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Only coaches and admins can access coach onboarding
  let userRole: 'admin' | 'coach' | 'client' = 'client';
  try {
    const dbUser = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (dbUser.length > 0 && dbUser[0].role) {
      userRole = dbUser[0].role;
    }
  } catch {
    // Default to client if DB query fails
  }

  if (userRole !== 'admin' && userRole !== 'coach') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
