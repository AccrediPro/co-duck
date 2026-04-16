/**
 * @fileoverview Convert AI-suggested action items → real action_items rows (P0-10)
 *
 * Coach selects a subset of `actionItemsSuggested` strings from the AI notes
 * and posts them here. Each becomes a real `action_items` row linked to the
 * booking & client. The selected suggestions are then removed from the
 * `actionItemsSuggested` array so the coach doesn't re-create duplicates.
 *
 * @module api/bookings/[id]/ai-notes/action-items
 */

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, bookings, sessionNotes, actionItems } from '@/db';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const BodySchema = z.object({
  titles: z.array(z.string().min(1).max(200)).min(1).max(20),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD')
    .optional(),
});

export async function POST(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'ai-notes-action-items');
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'Request body must be JSON.' } },
      { status: 400 }
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      },
      { status: 400 }
    );
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });
  if (!booking) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } },
      { status: 404 }
    );
  }
  if (booking.coachId !== userId) {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Only the coach can create action items.' } },
      { status: 403 }
    );
  }

  const titles = parsed.data.titles;
  const dueDate = parsed.data.dueDate ?? null;

  // Insert one action_item per title
  const rows = titles.map((title) => ({
    coachId: userId,
    clientId: booking.clientId,
    bookingId: booking.id,
    title: title.slice(0, 200),
    description: null,
    dueDate,
  }));

  const inserted = await db.insert(actionItems).values(rows).returning({
    id: actionItems.id,
    title: actionItems.title,
  });

  // Remove the chosen suggestions from actionItemsSuggested so the coach
  // doesn't re-create duplicates from the card.
  const note = await db.query.sessionNotes.findFirst({
    where: eq(sessionNotes.bookingId, bookingId),
    columns: { actionItemsSuggested: true },
  });
  if (note?.actionItemsSuggested && Array.isArray(note.actionItemsSuggested)) {
    const chosen = new Set(titles);
    const remaining = note.actionItemsSuggested.filter((s) => !chosen.has(s));
    if (remaining.length !== note.actionItemsSuggested.length) {
      await db
        .update(sessionNotes)
        .set({ actionItemsSuggested: remaining })
        .where(eq(sessionNotes.bookingId, bookingId));
    }
  }

  // Notify the client (fire-and-forget)
  createNotification({
    userId: booking.clientId,
    type: 'action_item',
    title: `${titles.length} new action item${titles.length === 1 ? '' : 's'} from your coach`,
    body: titles.slice(0, 3).join(' • '),
    link: '/dashboard/action-items',
  }).catch((err) => {
    console.error('Failed to create action_item notification:', err);
  });

  return Response.json({ success: true, data: { created: inserted } });
}
