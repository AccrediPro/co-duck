import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db, bookings, users } from '@/db';
import { resolveIntakeFormForSession, findIntakeResponseForBooking } from '@/lib/intake-forms';
import { coachProfiles } from '@/db/schema';
import type { BookingSessionType, SessionType } from '@/db/schema';
import { IntakeRunnerClient } from './intake-runner-client';

export const metadata = {
  title: 'Complete your intake | Coaching Platform',
};

interface PageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function BookingIntakePage({ params }: PageProps) {
  const { bookingId: raw } = await params;
  const bookingId = parseInt(raw, 10);
  if (Number.isNaN(bookingId)) notFound();

  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=/booking/${raw}/intake`);
  }

  const rows = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (rows.length === 0) notFound();

  const booking = rows[0];
  if (booking.clientId !== userId) {
    // Client mismatch — treat like not found to avoid leaking info
    notFound();
  }

  if (booking.status === 'cancelled' || booking.status === 'completed') {
    redirect('/dashboard/my-sessions');
  }

  // Find the matching session type id so we can resolve per-session-type intake
  const profileRows = await db
    .select({ sessionTypes: coachProfiles.sessionTypes })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, booking.coachId))
    .limit(1);

  const sessionTypeName = (booking.sessionType as BookingSessionType | null)?.name ?? null;
  const matchingSessionType = (profileRows[0]?.sessionTypes as SessionType[] | null)?.find(
    (st) => st.name === sessionTypeName
  );

  const form = await resolveIntakeFormForSession(booking.coachId, matchingSessionType?.id);

  const coachUser = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, booking.coachId))
    .limit(1);

  if (!form) {
    // No intake required — send them to sessions list
    redirect('/dashboard/my-sessions');
  }

  const existingResponseId = booking.intakeResponseId
    ? booking.intakeResponseId
    : await findIntakeResponseForBooking(bookingId, userId);

  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {coachUser[0]?.name ? `Intake for ${coachUser[0].name}` : 'Client intake'}
          </p>
          <h1 className="text-2xl font-bold">{form.title}</h1>
          {form.description && (
            <p className="mt-2 text-sm text-muted-foreground">{form.description}</p>
          )}
        </div>
        <IntakeRunnerClient
          bookingId={bookingId}
          form={{
            id: form.id,
            title: form.title,
            description: form.description,
            questions: form.questions,
          }}
          alreadyAnswered={existingResponseId !== null}
        />
      </div>
    </div>
  );
}
