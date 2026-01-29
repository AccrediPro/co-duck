import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, users, coachProfiles } from '@/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { User } from 'lucide-react';
import { getPaymentsData, checkStripeAccountStatus } from './actions';
import { PaymentsContent } from '@/components/payments';

export const metadata = {
  title: 'Payments | Coaching Platform',
  description: 'Manage your payment settings and Stripe Connect account',
};

interface PaymentsPageProps {
  searchParams: Promise<{ setup?: string }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const { userId } = await auth();
  const params = await searchParams;

  if (!userId) {
    redirect('/sign-in');
  }

  // Check if user is a coach
  const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (userRecords.length === 0) {
    redirect('/dashboard');
  }

  const user = userRecords[0];

  // If not a coach, show appropriate message
  if (user.role !== 'coach') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Manage your payment settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Become a Coach</CardTitle>
            <CardDescription>
              You need to be registered as a coach to set up payment processing.
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

  // Check if coach has completed onboarding
  const profiles = await db
    .select()
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  if (profiles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Manage your payment settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Complete Your Onboarding</CardTitle>
            <CardDescription>
              You need to complete the coach onboarding before you can set up payment processing.
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

  // Check for return/refresh from Stripe onboarding
  const setupStatus = params.setup;

  // If returning from Stripe, check the actual account status
  if (setupStatus === 'complete' || setupStatus === 'refresh') {
    await checkStripeAccountStatus();
  }

  // Get payments data
  const result = await getPaymentsData();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Manage your payment settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Error Loading Payment Settings</CardTitle>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="text-muted-foreground">
          Set up and manage your payment processing to receive payments from clients.
        </p>
      </div>

      <PaymentsContent initialData={result.data} setupStatus={setupStatus} />
    </div>
  );
}
