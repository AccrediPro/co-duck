import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCoachForBooking } from '../actions';
import { getBookingFromCheckoutSession } from './actions';
import { PaymentSuccessContent } from '@/components/booking';
import { db, bookings } from '@/db';
import { eq } from 'drizzle-orm';
import type { SessionType, BookingSessionType } from '@/db/schema';
import { coachProfiles } from '@/db/schema';
import { resolveIntakeFormForSession, findIntakeResponseForBooking } from '@/lib/intake-forms';

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

  // Check whether this booking has a required intake form not yet submitted.
  // We look up the coach's session types to find the id that matches the name
  // stored in the booking snapshot, then resolve the form.
  const intake = await resolveIntakeForBooking(bookingResult.data.id);

  return (
    <div className="container mx-auto px-4 py-8">
      <PaymentSuccessContent
        coach={coachResult.data}
        slug={slug}
        booking={bookingResult.data}
        intake={intake}
      />
    </div>
  );
}

/**
 * Looks up whether the given booking has a required intake form not yet
 * submitted, and returns the info needed to surface an intake prompt on the
 * success page. Returns null if no intake applies.
 */
async function resolveIntakeForBooking(
  bookingId: number
): Promise<{ required: true; submitted: boolean; intakeUrl: string } | null> {
  const rows = await db
    .select({
      id: bookings.id,
      coachId: bookings.coachId,
      clientId: bookings.clientId,
      sessionType: bookings.sessionType,
      intakeResponseId: bookings.intakeResponseId,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (rows.length === 0) return null;
  const b = rows[0];

  const profile = await db
    .select({ sessionTypes: coachProfiles.sessionTypes })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, b.coachId))
    .limit(1);

  const bookingSessionTypeName = (b.sessionType as BookingSessionType | null)?.name ?? null;
  const match = (profile[0]?.sessionTypes as SessionType[] | null)?.find(
    (st) => st.name === bookingSessionTypeName
  );

  const form = await resolveIntakeFormForSession(b.coachId, match?.id);
  if (!form) return null;

  const existingResponseId = b.intakeResponseId
    ? b.intakeResponseId
    : await findIntakeResponseForBooking(b.id, b.clientId);

  return {
    required: true,
    submitted: existingResponseId !== null,
    intakeUrl: `/booking/${b.id}/intake`,
  };
}
