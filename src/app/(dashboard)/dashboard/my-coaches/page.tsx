import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MyCoachesList } from '@/components/dashboard/my-coaches-list';

export const metadata = {
  title: 'My Coach | Coaching Platform',
  description: 'View your coaches and coaching programs',
};

async function getMyCoaches() {
  const { userId } = await auth();
  if (!userId) return null;

  const { headers: getHeaders } = await import('next/headers');
  const headersList = await getHeaders();
  const cookie = headersList.get('cookie') || '';
  const host = headersList.get('host') || 'localhost:3001';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const res = await fetch(`${baseUrl}/api/my-coaches?limit=50`, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json.success ? json.data.coaches : null;
}

export default async function MyCoachesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const coaches = await getMyCoaches();

  if (!coaches) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-burgundy-dark">My Coaches</CardTitle>
            <CardDescription>View your coaching relationships</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Failed to load coaches. Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (coaches.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-burgundy-dark">My Coaches</CardTitle>
            <CardDescription>View your coaching relationships</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-burgundy/10">
                <UserCheck className="h-8 w-8 text-burgundy" />
              </div>
              <CardTitle>You&apos;re not working with any coach yet</CardTitle>
              <CardDescription className="mx-auto max-w-md">
                Find a coach and book a session! The relationship is created automatically after
                your first confirmed booking.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link
                href="/coaches"
                className="inline-flex items-center justify-center rounded-md bg-burgundy px-4 py-2 text-sm font-medium text-white hover:bg-burgundy-light"
              >
                Find a Coach
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-burgundy-dark">My Coaches</CardTitle>
          <CardDescription>View your coaching relationships</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        <MyCoachesList coaches={coaches} />
      </div>
    </div>
  );
}
