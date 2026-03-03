import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDateLong, formatTime } from '@/lib/date-utils';
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
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href={`/dashboard/sessions/${sessionId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Session
          </Link>
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Reschedule Session</CardTitle>
            <CardDescription>Choose a new date and time</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-gold" />
              <h2 className="text-xl font-semibold">Cannot Reschedule</h2>
              <p className="mt-2 text-muted-foreground">{result.error}</p>
              <Button className="mt-6" asChild>
                <Link href={`/dashboard/sessions/${sessionId}`}>Return to Session Details</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const booking = result.data;

  return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={`/dashboard/sessions/${booking.id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Session
        </Link>
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Reschedule Session</CardTitle>
          <CardDescription>
            Choose a new time for your session with {booking.coachName}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-6">
        {/* Current Booking Info */}
        <Card className="border-gold/30 bg-gold/5 dark:border-gold-dark dark:bg-gold-dark/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-burgundy-dark dark:text-gold">
              <Clock className="h-4 w-4" />
              Current Booking
            </CardTitle>
            <CardDescription className="text-burgundy dark:text-gold/80">
              Your current session is scheduled for:
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-lg bg-gold/10 p-3 dark:bg-gold-dark/20">
              <p className="font-medium text-burgundy-dark dark:text-gold">
                {booking.sessionType.name}
              </p>
              <p className="text-sm text-burgundy dark:text-gold/80">
                {formatDateLong(new Date(booking.originalStartTime))}
              </p>
              <p className="text-sm text-burgundy dark:text-gold/80">
                {formatTime(new Date(booking.originalStartTime))} -{' '}
                {formatTime(new Date(booking.originalEndTime))}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Reschedule Flow */}
        <RescheduleFlow booking={booking} />
      </div>
    </div>
  );
}
