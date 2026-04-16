/**
 * @fileoverview Send Follow-Up Email API (P0-10)
 *
 * Sends the coach-approved follow-up email draft to the client via Resend.
 * Coach must have reviewed the draft — we always use the current values
 * stored on `session_notes` (subject + body) so any edits are picked up.
 *
 * @module api/bookings/[id]/ai-notes/send-follow-up
 */

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, bookings, sessionNotes, users } from '@/db';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';
import { SessionFollowUpEmail } from '@/lib/emails';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const BodySchema = z
  .object({
    subject: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(20_000).optional(),
  })
  .optional();

export async function POST(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'ai-notes-send-follow-up');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return Response.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid session id.' } },
      { status: 400 }
    );
  }

  let body: unknown = undefined;
  if (request.headers.get('content-length') !== '0') {
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }
  }
  const overrides = BodySchema.safeParse(body);
  if (!overrides.success) {
    return Response.json(
      {
        success: false,
        error: { code: 'INVALID_INPUT', message: overrides.error.issues[0]?.message ?? 'Invalid input' },
      },
      { status: 400 }
    );
  }

  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) });
  if (!booking) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } },
      { status: 404 }
    );
  }
  if (booking.coachId !== userId) {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only the coach can send the follow-up email.' } },
      { status: 403 }
    );
  }

  const note = await db.query.sessionNotes.findFirst({
    where: eq(sessionNotes.bookingId, bookingId),
    columns: { followUpEmailSubject: true, followUpEmailBody: true },
  });

  const subject = overrides.data?.subject ?? note?.followUpEmailSubject ?? '';
  const emailBody = overrides.data?.body ?? note?.followUpEmailBody ?? '';

  if (!subject.trim() || !emailBody.trim()) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'EMPTY_DRAFT',
          message: 'The follow-up email draft is empty — generate or edit it first.',
        },
      },
      { status: 400 }
    );
  }

  // Persist any inline overrides the coach passed (so the UI stays consistent)
  if (overrides.data?.subject || overrides.data?.body) {
    await db
      .update(sessionNotes)
      .set({
        followUpEmailSubject: subject,
        followUpEmailBody: emailBody,
      })
      .where(eq(sessionNotes.bookingId, bookingId))
      .catch((err) => console.error('Failed to persist follow-up overrides:', err));
  }

  const [coach, client] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { name: true, email: true },
    }),
    db.query.users.findFirst({
      where: eq(users.id, booking.clientId),
      columns: { name: true, email: true },
    }),
  ]);

  if (!client?.email) {
    return Response.json(
      { success: false, error: { code: 'NO_CLIENT_EMAIL', message: 'Client has no email on file.' } },
      { status: 400 }
    );
  }

  const result = await sendEmail({
    to: client.email,
    subject,
    react: SessionFollowUpEmail({
      clientName: client.name ?? 'there',
      coachName: coach?.name ?? 'Your Coach',
      subject,
      body: emailBody,
      unsubscribeUrl: getUnsubscribeUrl(booking.clientId, 'bookings'),
    }),
  });

  if (!result.success) {
    return Response.json(
      {
        success: false,
        error: { code: 'EMAIL_FAILED', message: result.error ?? 'Failed to send email.' },
      },
      { status: 502 }
    );
  }

  return Response.json({
    success: true,
    data: { sent: true, emailId: result.data?.id ?? null },
  });
}
