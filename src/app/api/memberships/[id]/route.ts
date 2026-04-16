/**
 * @fileoverview Single-membership API
 *
 * - GET    /api/memberships/[id]: fetch one (public if active, coach-only otherwise)
 * - PATCH  /api/memberships/[id]: coach updates name / description / price /
 *   includesMessaging. Price changes create a new Stripe Price and rotate the
 *   pointer; existing subscriptions keep the old price until explicitly migrated.
 * - DELETE /api/memberships/[id]: soft-deactivate. Existing subscriptions
 *   continue to renew until canceled by their owner. No new subscriptions can
 *   be created.
 *
 * @module api/memberships/[id]
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { memberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { rateLimit, WRITE_LIMIT, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { updateMembershipSchema } from '@/lib/validators/memberships';
import { serializeMembership } from '@/lib/serializers/memberships';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'membership-get');
  if (!rl.success) return rateLimitResponse(rl);

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return Response.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid membership id' } },
      { status: 400 }
    );
  }

  try {
    const row = await db.query.memberships.findFirst({ where: eq(memberships.id, id) });
    if (!row) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Membership not found' } },
        { status: 404 }
      );
    }

    // Inactive memberships are only visible to their owner.
    if (!row.isActive) {
      const { userId } = await auth();
      if (!userId || userId !== row.coachId) {
        return Response.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Membership not found' } },
          { status: 404 }
        );
      }
    }

    return Response.json({ success: true, data: { membership: serializeMembership(row) } });
  } catch (error) {
    console.error('[memberships/[id]:GET]', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch membership' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'membership-update');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return Response.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid membership id' } },
      { status: 400 }
    );
  }

  const existing = await db.query.memberships.findFirst({ where: eq(memberships.id, id) });
  if (!existing) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Membership not found' } },
      { status: 404 }
    );
  }
  if (existing.coachId !== userId) {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'You do not own this membership' } },
      { status: 403 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
      },
      { status: 400 }
    );
  }

  const parsed = updateMembershipSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { name, description, monthlyPriceCents, includesMessaging } = parsed.data;

  try {
    const updates: Partial<typeof memberships.$inferInsert> = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description ?? null;
    if (includesMessaging !== undefined) updates.includesMessaging = includesMessaging;

    // Price change → create a new immutable Stripe Price and rotate the pointer.
    if (
      monthlyPriceCents !== undefined &&
      monthlyPriceCents !== existing.monthlyPriceCents &&
      existing.stripeProductId
    ) {
      const price = await stripe.prices.create({
        product: existing.stripeProductId,
        unit_amount: monthlyPriceCents,
        currency: existing.currency,
        recurring: { interval: 'month' },
        metadata: {
          coachId: userId,
          productKind: 'membership',
        },
      });

      // Deactivate the old price so it is not reused accidentally.
      if (existing.stripePriceId) {
        await stripe.prices.update(existing.stripePriceId, { active: false }).catch((err) => {
          console.warn('[memberships/[id]:PATCH] Could not deactivate old price', err);
        });
      }

      updates.monthlyPriceCents = monthlyPriceCents;
      updates.stripePriceId = price.id;
    }

    // If product metadata has drifted (name/description), push the update to Stripe.
    if ((name !== undefined || description !== undefined) && existing.stripeProductId) {
      await stripe.products
        .update(existing.stripeProductId, {
          name: `Membership: ${name ?? existing.name}`,
          description: description ?? existing.description ?? undefined,
        })
        .catch((err) => {
          console.warn('[memberships/[id]:PATCH] Could not update Stripe product', err);
        });
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({
        success: true,
        data: { membership: serializeMembership(existing) },
      });
    }

    const [row] = await db
      .update(memberships)
      .set(updates)
      .where(eq(memberships.id, id))
      .returning();

    return Response.json({ success: true, data: { membership: serializeMembership(row) } });
  } catch (error) {
    console.error('[memberships/[id]:PATCH]', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update membership' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'membership-delete');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return Response.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid membership id' } },
      { status: 400 }
    );
  }

  const existing = await db.query.memberships.findFirst({ where: eq(memberships.id, id) });
  if (!existing) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Membership not found' } },
      { status: 404 }
    );
  }
  if (existing.coachId !== userId) {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'You do not own this membership' } },
      { status: 403 }
    );
  }

  try {
    // Soft deactivate — existing subscriptions continue to renew until canceled by client.
    const [row] = await db
      .update(memberships)
      .set({ isActive: false })
      .where(eq(memberships.id, id))
      .returning();

    if (existing.stripePriceId) {
      // Prevent new checkouts from using this price.
      await stripe.prices.update(existing.stripePriceId, { active: false }).catch((err) => {
        console.warn('[memberships/[id]:DELETE] Could not deactivate Stripe price', err);
      });
    }

    return Response.json({ success: true, data: { membership: serializeMembership(row) } });
  } catch (error) {
    console.error('[memberships/[id]:DELETE]', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate membership' },
      },
      { status: 500 }
    );
  }
}
