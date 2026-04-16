'use server';

/**
 * Embed booking — server actions.
 *
 * Unlike the signed-in booking flow, the widget is used on 3rd-party sites
 * (Squarespace/WordPress/Linktree) where visitors are *not* authenticated
 * in our Clerk session. We accept a guest name + email, upsert a user row
 * by email (using a synthesized `guest_*` id when the email is new), and
 * then reuse the existing Stripe Connect checkout pipeline.
 *
 * Security notes:
 * - All user-controlled inputs are validated with Zod.
 * - The synthesized guest id uses `crypto.randomUUID()` — it never collides
 *   with real Clerk ids (which start with `user_`).
 * - Stripe webhook reconciles the booking → transaction the same way as
 *   the signed-in flow (see `/api/webhooks/stripe`).
 */

import { randomUUID } from 'crypto';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db, bookings, coachProfiles, users } from '@/db';
import { stripe } from '@/lib/stripe';
import { formatDateLong, formatTime } from '@/lib/date-utils';
import type { SessionType } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// Input schema
// ─────────────────────────────────────────────────────────────────────────────

const inputSchema = z.object({
  coachSlug: z.string().min(1).max(128),
  sessionTypeId: z.string().min(1).max(128),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  clientTimezone: z.string().min(1).max(128),
  guestName: z.string().min(2).max(120),
  guestEmail: z.string().email().max(200),
  clientNotes: z.string().max(2000).optional(),
});

export type CreateEmbedCheckoutInput = z.infer<typeof inputSchema>;
export type CreateEmbedCheckoutResult =
  | { success: true; checkoutUrl: string; bookingId: number }
  | { success: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Action
// ─────────────────────────────────────────────────────────────────────────────

export async function createEmbedCheckoutSession(
  rawInput: CreateEmbedCheckoutInput
): Promise<CreateEmbedCheckoutResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: 'Invalid booking details.' };
  }
  const input = parsed.data;

  try {
    // Look up the coach by slug.
    const coachRows = await db
      .select({
        userId: coachProfiles.userId,
        slug: coachProfiles.slug,
        sessionTypes: coachProfiles.sessionTypes,
        currency: coachProfiles.currency,
        stripeAccountId: coachProfiles.stripeAccountId,
        stripeOnboardingComplete: coachProfiles.stripeOnboardingComplete,
        isPublished: coachProfiles.isPublished,
        coachName: users.name,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(coachProfiles.userId, users.id))
      .where(and(eq(coachProfiles.slug, input.coachSlug), eq(coachProfiles.isPublished, true)))
      .limit(1);

    if (coachRows.length === 0) {
      return { success: false, error: 'Coach not available.' };
    }
    const coach = coachRows[0];

    // Resolve session type from the coach's published list.
    const session = (coach.sessionTypes ?? []).find(
      (s: SessionType) => s.id === input.sessionTypeId
    );
    if (!session) {
      return { success: false, error: 'Session type not found.' };
    }

    if (!coach.stripeAccountId || !coach.stripeOnboardingComplete) {
      return {
        success: false,
        error: 'This coach has not finished setting up payments yet.',
      };
    }

    // Validate times.
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    if (
      isNaN(startTime.getTime()) ||
      isNaN(endTime.getTime()) ||
      startTime >= endTime ||
      startTime < new Date()
    ) {
      return { success: false, error: 'Invalid session time.' };
    }

    // Upsert the guest user by email.
    const clientId = await upsertGuestByEmail(input.guestEmail, input.guestName);

    if (clientId === coach.userId) {
      return { success: false, error: 'You cannot book a session with yourself.' };
    }

    // Create the pending booking.
    const [newBooking] = await db
      .insert(bookings)
      .values({
        coachId: coach.userId,
        clientId,
        sessionType: {
          name: session.name,
          duration: session.duration,
          price: session.price,
        },
        startTime,
        endTime,
        status: 'pending',
        clientNotes: input.clientNotes ?? null,
      })
      .returning({ id: bookings.id });

    if (!newBooking) {
      return { success: false, error: 'Failed to create booking.' };
    }

    // Build Stripe Checkout session.
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const platformFeeAmount = Math.round(session.price * 0.1);
    const sessionDate = formatDateLong(startTime);
    const sessionTime = formatTime(startTime);

    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: input.guestEmail,
        line_items: [
          {
            price_data: {
              currency: (coach.currency || 'usd').toLowerCase(),
              unit_amount: session.price,
              product_data: {
                name: `Coaching Session: ${session.name}`,
                description: `${session.duration} minute session with ${coach.coachName || 'Coach'} on ${sessionDate} at ${sessionTime}`,
              },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          transfer_data: { destination: coach.stripeAccountId },
          application_fee_amount: platformFeeAmount,
          metadata: {
            bookingId: newBooking.id.toString(),
            coachId: coach.userId,
            clientId,
            sessionTypeName: session.name,
            sessionDuration: session.duration.toString(),
            sessionPrice: session.price.toString(),
            source: 'embed-widget',
          },
        },
        metadata: {
          bookingId: newBooking.id.toString(),
          coachId: coach.userId,
          clientId,
          coachSlug: coach.slug,
          sessionTypeName: session.name,
          sessionDuration: session.duration.toString(),
          sessionPrice: session.price.toString(),
          startTime: input.startTime,
          endTime: input.endTime,
          clientTimezone: input.clientTimezone,
          source: 'embed-widget',
        },
        success_url: `${baseUrl}/coaches/${coach.slug}/book/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/coaches/${coach.slug}`,
      });
    } catch (stripeError) {
      // Rollback the pending booking if Stripe failed.
      await db.delete(bookings).where(eq(bookings.id, newBooking.id));
      console.error('[embed] Stripe checkout error', stripeError);
      return { success: false, error: 'Failed to start checkout. Please try again.' };
    }

    if (!checkoutSession.url) {
      await db.delete(bookings).where(eq(bookings.id, newBooking.id));
      return { success: false, error: 'Failed to start checkout.' };
    }

    return { success: true, checkoutUrl: checkoutSession.url, bookingId: newBooking.id };
  } catch (err) {
    console.error('[embed] createEmbedCheckoutSession error', err);
    return { success: false, error: 'Unexpected error. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guest user upsert
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the `users.id` for a guest, creating a new record if the email
 * isn't in the DB yet. Existing accounts (including real Clerk users) are
 * reused so that their booking history stays unified.
 */
async function upsertGuestByEmail(email: string, name: string): Promise<string> {
  const normalized = email.trim().toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const guestId = `guest_${randomUUID()}`;
  await db
    .insert(users)
    .values({
      id: guestId,
      email: normalized,
      name,
      role: 'client',
    })
    .onConflictDoNothing();

  // Re-read in case the insert hit a race and did nothing.
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (row.length === 0) {
    throw new Error('Failed to create guest user.');
  }
  return row[0].id;
}
