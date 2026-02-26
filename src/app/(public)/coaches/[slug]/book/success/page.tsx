import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCoachForBooking } from '../actions';
import { getBookingFromCheckoutSession } from './actions';
import { PaymentSuccessContent } from '@/components/booking';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    session_id?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCoachForBooking(slug);

  if (!result.success) {
    return {
      title: 'Booking Request Submitted | Coaching Platform',
    };
  }

  return {
    title: `Booking Request Submitted — ${result.data.name} | Coaching Platform`,
    description: `Your coaching session request with ${result.data.name} has been submitted and is awaiting approval.`,
  };
}

export default async function PaymentSuccessPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { session_id } = await searchParams;

  // Validate session_id is present
  if (!session_id) {
    redirect(`/coaches/${slug}`);
  }

  // Fetch coach data
  const coachResult = await getCoachForBooking(slug);

  if (!coachResult.success) {
    notFound();
  }

  // Fetch booking from checkout session
  const bookingResult = await getBookingFromCheckoutSession(session_id);

  if (!bookingResult.success) {
    // If we can't find the booking, show an error but don't redirect
    // Payment may have succeeded but our system hasn't processed it yet
    return (
      <div className="container mx-auto px-4 py-8">
        <PaymentSuccessContent coach={coachResult.data} slug={slug} error={bookingResult.error} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PaymentSuccessContent coach={coachResult.data} slug={slug} booking={bookingResult.data} />
    </div>
  );
}
