import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, forms, formResponses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { submitBookingIntakeSchema } from '@/lib/validators/intake-forms';
import { findIntakeResponseForBooking } from '@/lib/intake-forms';
import type { BookingSessionType } from '@/db/schema';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/bookings/[id]/intake
 *
 * Returns the intake form assigned to this booking (if any) + any prior
 * response submitted by the client. Used by the intake page and by the
 * confirm step to gate the flow.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, FREQUENT_LIMIT, 'booking-intake-get');
  if (!rl.success) return rateLimitResponse(rl);

  const { id } = await params;
  const bookingId = parseInt(id, 10);
  if (Number.isNaN(bookingId)) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
      { status: 404 }
    );
  }

  const rows = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);

  if (rows.length === 0) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
      { status: 404 }
    );
  }

  const booking = rows[0];
  if (booking.clientId !== userId) {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not your booking' } },
      { status: 403 }
    );
  }

  const sessionTypeName = (booking.sessionType as BookingSessionType | null)?.name ?? null;
  // Best-effort lookup by matching name against coach profile session types.
  // We store the id in the intake link via searchParams, but also fall back to
  // coach default if we cannot match.
  const intakeForm = await resolveIntakeFormForSessionByName(booking.coachId, sessionTypeName);

  const existingResponseId = booking.intakeResponseId
    ? booking.intakeResponseId
    : await findIntakeResponseForBooking(bookingId, userId);

  return Response.json({
    success: true,
    data: {
      booking: {
        id: booking.id,
        status: booking.status,
        sessionType: booking.sessionType,
      },
      form: intakeForm
        ? {
            id: intakeForm.id,
            title: intakeForm.title,
            description: intakeForm.description,
            questions: intakeForm.questions,
          }
        : null,
      existingResponseId,
    },
  });
}

/**
 * POST /api/bookings/[id]/intake
 *
 * Submits (or resubmits) the intake response for a booking and atomically
 * links it via bookings.intakeResponseId.
 *
 * Rules:
 * - Booking must belong to the current client
 * - Booking must still be `pending` or `confirmed` (no intake for cancelled/completed)
 * - If the booking already has a linked response, it is replaced
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, WRITE_LIMIT, 'booking-intake-submit');
  if (!rl.success) return rateLimitResponse(rl);

  const { id } = await params;
  const bookingId = parseInt(id, 10);
  if (Number.isNaN(bookingId)) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
      { status: 404 }
    );
  }

  const bookingRows = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (bookingRows.length === 0) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
      { status: 404 }
    );
  }

  const booking = bookingRows[0];
  if (booking.clientId !== userId) {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not your booking' } },
      { status: 403 }
    );
  }

  if (booking.status === 'cancelled' || booking.status === 'completed') {
    return Response.json(
      {
        success: false,
        error: { code: 'CONFLICT', message: 'Cannot submit intake for this booking' },
      },
      { status: 409 }
    );
  }

  const body = await request.json();
  const parsed = submitBookingIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
      },
      { status: 422 }
    );
  }

  const sessionTypeName = (booking.sessionType as BookingSessionType | null)?.name ?? null;
  const form = await resolveIntakeFormForSessionByName(booking.coachId, sessionTypeName);

  if (!form) {
    return Response.json(
      {
        success: false,
        error: { code: 'NO_INTAKE', message: 'No intake form is assigned to this booking' },
      },
      { status: 400 }
    );
  }

  // Validate required questions
  const answers = parsed.data.answers;
  const missing = form.questions.filter((q) => {
    if (!q.required) return false;
    const a = answers[q.id];
    if (a === undefined || a === null || a === '') return true;
    if (Array.isArray(a) && a.length === 0) return true;
    return false;
  });

  if (missing.length > 0) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required answers: ${missing.map((q) => q.label).join(', ')}`,
        },
      },
      { status: 422 }
    );
  }

  // Replace any existing response for this booking/client pair.
  await db
    .delete(formResponses)
    .where(
      and(
        eq(formResponses.bookingId, bookingId),
        eq(formResponses.respondentId, userId),
        eq(formResponses.formId, form.id)
      )
    );

  const [created] = await db
    .insert(formResponses)
    .values({
      formId: form.id,
      respondentId: userId,
      bookingId,
      answers,
    })
    .returning();

  await db.update(bookings).set({ intakeResponseId: created.id }).where(eq(bookings.id, bookingId));

  return Response.json({
    success: true,
    data: { responseId: created.id, bookingId },
  });
}

/**
 * Helper: resolves the intake form by matching the booking's session type name
 * against the coach's current session_types array (which is where intakeFormId
 * is stored). This is a best-effort match — new bookings created before the
 * intake feature shipped will just fall back to the coach default.
 */
async function resolveIntakeFormForSessionByName(coachId: string, sessionTypeName: string | null) {
  // Look up coach's session types to find the matching id for this name.
  const { coachProfiles } = await import('@/db/schema');
  const profileRows = await db
    .select({
      sessionTypes: coachProfiles.sessionTypes,
      defaultIntakeFormId: coachProfiles.defaultIntakeFormId,
    })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, coachId))
    .limit(1);

  if (profileRows.length === 0) return null;
  const { sessionTypes, defaultIntakeFormId } = profileRows[0];
  const match = (sessionTypes as import('@/db/schema').SessionType[] | null)?.find(
    (st) => st.name === sessionTypeName
  );

  let formId: number | null = match?.intakeFormId ?? null;
  if (formId == null && defaultIntakeFormId != null) {
    formId = defaultIntakeFormId;
  }
  if (formId == null) return null;

  const rows = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.isPublished, true)))
    .limit(1);

  return rows[0] ?? null;
}
