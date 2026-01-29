import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, AlertTriangle } from 'lucide-react';
import { getRescheduleBookingData } from './actions';
import { RescheduleFlow } from './reschedule-flow';

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

  // Get booking data
  const result = await getRescheduleBookingData(sessionId);

  if (!result.success) {
    // Show error state
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
            <p className="mt-2 text-muted-foreground">{result.error}</p>
            <Button className="mt-6" asChild>
              <Link href={`/dashboard/sessions/${sessionId}`}>Return to Session Details</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const booking = result.data;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href={`/dashboard/sessions/${booking.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Session
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Reschedule Session</h1>
        <p className="text-muted-foreground">
          Choose a new time for your session with {booking.coachName}
        </p>
      </div>

      {/* Current Booking Info */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-200">
            <Clock className="h-4 w-4" />
            Current Booking
          </CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-300">
            Your current session is scheduled for:
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-lg bg-amber-100/50 p-3 dark:bg-amber-900/30">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              {booking.sessionType.name}
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {format(new Date(booking.originalStartTime), 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {format(new Date(booking.originalStartTime), 'h:mm a')} -{' '}
              {format(new Date(booking.originalEndTime), 'h:mm a')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Reschedule Flow */}
      <RescheduleFlow booking={booking} />
    </div>
  );
}
