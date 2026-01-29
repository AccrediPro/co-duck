import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getCoachForBooking } from '../actions';
import { BookingConfirmation } from '@/components/booking';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sessionId?: string;
    startTime?: string;
    endTime?: string;
    timezone?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCoachForBooking(slug);

  if (!result.success) {
    return {
      title: 'Confirm Booking | Coaching Platform',
    };
  }

  return {
    title: `Confirm Booking with ${result.data.name} | Coaching Platform`,
    description: `Confirm your coaching session with ${result.data.name}. Review the details and complete your booking.`,
  };
}

export default async function ConfirmBookingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { sessionId, startTime, endTime, timezone } = await searchParams;

  // Validate required params
  if (!sessionId || !startTime || !endTime || !timezone) {
    // Missing booking data, redirect back to booking page
    redirect(`/coaches/${slug}/book`);
  }

  // Fetch coach data
  const result = await getCoachForBooking(slug);

  if (!result.success) {
    notFound();
  }

  // Find the selected session type
  const selectedSession = result.data.sessionTypes.find((s) => s.id === sessionId);

  if (!selectedSession) {
    // Invalid session type, redirect back to booking page
    redirect(`/coaches/${slug}/book`);
  }

  // Check if user is authenticated
  const { userId } = await auth();

  // Build the return URL for after sign-in
  const currentUrl = `/coaches/${slug}/book/confirm?sessionId=${sessionId}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&timezone=${encodeURIComponent(timezone)}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <BookingConfirmation
        coach={result.data}
        slug={slug}
        sessionType={selectedSession}
        startTime={startTime}
        endTime={endTime}
        clientTimezone={timezone}
        isAuthenticated={!!userId}
        returnUrl={currentUrl}
      />
    </div>
  );
}
