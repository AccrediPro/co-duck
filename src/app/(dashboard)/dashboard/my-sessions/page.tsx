import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClientSessionsList } from '@/components/sessions';
import { Users } from 'lucide-react';
import {
  getClientSessions,
  type ClientSessionStatus,
} from '@/app/(dashboard)/dashboard/my-sessions/actions';

export const metadata = {
  title: 'My Sessions | Coaching Platform',
  description: 'View and manage your coaching sessions',
};

interface PageProps {
  searchParams: Promise<{ tab?: string; page?: string }>;
}

export default async function MySessionsPage({ searchParams }: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const params = await searchParams;

  // Parse URL params
  const tab: ClientSessionStatus =
    params.tab === 'upcoming' || params.tab === 'past' ? params.tab : 'upcoming';
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const perPage = 10;

  // Fetch sessions
  const sessionsResult = await getClientSessions(tab, page, perPage);

  if (!sessionsResult.success) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-burgundy-dark">My Sessions</CardTitle>
            <CardDescription>Track your coaching journey</CardDescription>
          </CardHeader>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {sessionsResult.error || 'Failed to load sessions'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check if user has any sessions at all
  if (sessionsResult.totalCount === 0 && tab === 'upcoming') {
    // Check past sessions too
    const pastResult = await getClientSessions('past', 1, 1);
    const hasAnySessions = pastResult.success && (pastResult.totalCount || 0) > 0;

    if (!hasAnySessions) {
      // No sessions at all - show welcome state
      return (
        <div className="mx-auto max-w-3xl">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-burgundy-dark">My Sessions</CardTitle>
              <CardDescription>Track your coaching journey</CardDescription>
            </CardHeader>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-burgundy/10">
                  <Users className="h-8 w-8 text-burgundy" />
                </div>
                <CardTitle>No Sessions Yet</CardTitle>
                <CardDescription className="mx-auto max-w-md">
                  You haven&apos;t booked any coaching sessions yet. Browse our coaches and find the
                  perfect match for your goals.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pb-8">
                <Button asChild size="lg" className="bg-burgundy text-white hover:bg-burgundy-light">
                  <Link href="/coaches">Browse Coaches</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-burgundy-dark">My Sessions</CardTitle>
            <CardDescription>Track your coaching journey</CardDescription>
          </div>
          <Button asChild className="min-h-[44px] bg-burgundy text-white hover:bg-burgundy-light">
            <Link href="/coaches">Book New Session</Link>
          </Button>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        <ClientSessionsList
          initialTab={tab}
          initialSessions={sessionsResult.sessions || []}
          initialTotalCount={sessionsResult.totalCount || 0}
          currentPage={page}
          perPage={perPage}
        />
      </div>
    </div>
  );
}
