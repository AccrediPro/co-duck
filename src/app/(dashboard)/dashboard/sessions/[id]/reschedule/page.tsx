import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { format } from 'date-fns';
import Link from 'next/link';
import { db, bookings, users } from '@/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Reschedule Session | Coaching Platform',
  description: 'Reschedule your coaching session',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReschedulePage({ params }: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const sessionId = parseInt(id, 10);

  if (isNaN(sessionId)) {
    notFound();
  }

  // Fetch the booking - only allow client to reschedule
  const bookingData = await db
    .select({
      id: bookings.id,
      coachId: bookings.coachId,
      clientId: bookings.clientId,
      sessionType: bookings.sessionType,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
    })
    .from(bookings)
    .where(and(eq(bookings.id, sessionId), eq(bookings.clientId, userId)))
    .limit(1);

  if (bookingData.length === 0) {
    notFound();
  }

  const session = bookingData[0];

  // Check if session can be rescheduled
  const isUpcoming = new Date(session.startTime) > new Date();
  const canReschedule =
    isUpcoming && session.status !== 'cancelled' && session.status !== 'completed';

  // Get coach info
  const coachData = await db
    .select({
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, session.coachId))
    .limit(1);

  const coachName = coachData.length > 0 ? coachData[0].name : 'Coach';

  if (!canReschedule) {
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href={`/dashboard/sessions/${sessionId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Session
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Reschedule Session</h1>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h2 className="text-xl font-semibold">Cannot Reschedule</h2>
            <p className="mt-2 text-muted-foreground">
              This session cannot be rescheduled. Sessions can only be rescheduled if they are
              upcoming and not already cancelled or completed.
            </p>
            <Button className="mt-6" asChild>
              <Link href={`/dashboard/sessions/${sessionId}`}>Return to Session Details</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href={`/dashboard/sessions/${sessionId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Session
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Reschedule Session</h1>
        <p className="text-muted-foreground">Choose a new time for your session with {coachName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Booking
          </CardTitle>
          <CardDescription>Your current session is scheduled for:</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4">
            <p className="font-medium">{session.sessionType.name}</p>
            <p className="text-muted-foreground">
              {format(new Date(session.startTime), 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-muted-foreground">
              {format(new Date(session.startTime), 'h:mm a')} -{' '}
              {format(new Date(session.endTime), 'h:mm a')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="text-amber-700 dark:text-amber-300">
          <p>
            The reschedule feature is currently under development. For now, please cancel this
            session and book a new one at your preferred time.
          </p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/sessions/${sessionId}`}>Back to Session</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
