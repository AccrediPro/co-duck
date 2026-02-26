import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Coach</h1>
          <p className="text-muted-foreground">Your coaching relationships and programs</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Failed to load coaches. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (coaches.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Coach</h1>
          <p className="text-muted-foreground">Your coaching relationships and programs</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <UserCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>You&apos;re not working with any coach yet</CardTitle>
            <CardDescription className="mx-auto max-w-md">
              Find a coach and book a session! The relationship is created automatically after
              your first confirmed booking.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <a
              href="/coaches"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Find a Coach
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Coach</h1>
        <p className="text-muted-foreground">Your coaching relationships and programs</p>
      </div>

      <MyCoachesList coaches={coaches} />
    </div>
  );
}
