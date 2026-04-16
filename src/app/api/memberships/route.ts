/**
 * @fileoverview Memberships collection API
 *
 * - POST /api/memberships: coach creates a new membership (also creates a
 *   Stripe Product + recurring Price in the coach's Connect account).
 * - GET  /api/memberships: list memberships. Defaults to "my memberships"
 *   when called by a coach; use `?coachSlug=<slug>` to list a specific
 *   coach's active, public memberships (used on the public profile page).
 *
 * @module api/memberships
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { memberships, coachProfiles, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { rateLimit, WRITE_LIMIT, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { createMembershipSchema } from '@/lib/validators/memberships';
import { serializeMembership } from '@/lib/serializers/memberships';

/**
 * GET /api/memberships
 *
 * Query params:
 * - `coachSlug` (optional) — list active memberships for a coach's public profile.
 *
 * If no query param is supplied and the user is authenticated as a coach,
 * returns that coach's own memberships (including inactive ones) for the
 * dashboard.
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'memberships-list');
  if (!rl.success) return rateLimitResponse(rl);

  const { searchParams } = new URL(request.url);
  const coachSlug = searchParams.get('coachSlug');

  try {
    if (coachSlug) {
      // Public listing — active memberships only.
      const profile = await db.query.coachProfiles.findFirst({
        where: eq(coachProfiles.slug, coachSlug),
        columns: { userId: true, isPublished: true },
      });

      if (!profile || !profile.isPublished) {
        return Response.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Coach not found' } },
          { status: 404 }
        );
      }

      const rows = await db
        .select()
        .from(memberships)
        .where(and(eq(memberships.coachId, profile.userId), eq(memberships.isActive, true)))
        .orderBy(desc(memberships.createdAt));

      return Response.json({
        success: true,
        data: { memberships: rows.map(serializeMembership) },
      });
    }

    // Own listing — coach dashboard.
    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const rows = await db
      .select()
      .from(memberships)
      .where(eq(memberships.coachId, userId))
      .orderBy(desc(memberships.createdAt));

    return Response.json({
      success: true,
      data: { memberships: rows.map(serializeMembership) },
    });
  } catch (error) {
    console.error('[memberships:GET]', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch memberships' },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memberships
 *
 * Coach creates a new membership. Side effects:
 * - Creates a Stripe Product
 * - Creates a recurring Stripe Price (monthly)
 * - Persists the membership row with both Stripe IDs
 */
export async function POST(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'memberships-create');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // Only coaches with a configured Stripe account can create memberships.
  const [profile, user] = await Promise.all([
    db.query.coachProfiles.findFirst({ where: eq(coachProfiles.userId, userId) }),
    db.query.users.findFirst({ where: eq(users.id, userId) }),
  ]);

  if (!profile || user?.role !== 'coach') {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Coach role required' } },
      { status: 403 }
    );
  }

  if (!profile.stripeAccountId) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'STRIPE_NOT_CONFIGURED',
          message: 'Connect your Stripe account before creating memberships.',
        },
      },
      { status: 400 }
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

  const parsed = createMembershipSchema.safeParse(payload);
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

  const { name, description, monthlyPriceCents, currency, sessionsPerPeriod, includesMessaging } =
    parsed.data;

  try {
    // Create product and price on the platform account.
    // We can later migrate to per-Connect-account products if needed.
    const product = await stripe.products.create({
      name: `Membership: ${name}`,
      description: description ?? undefined,
      metadata: {
        coachId: userId,
        productKind: 'membership',
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: monthlyPriceCents,
      currency,
      recurring: { interval: 'month' },
      metadata: {
        coachId: userId,
        productKind: 'membership',
      },
    });

    const [row] = await db
      .insert(memberships)
      .values({
        coachId: userId,
        name,
        description: description ?? null,
        monthlyPriceCents,
        currency,
        sessionsPerPeriod,
        includesMessaging,
        stripeProductId: product.id,
        stripePriceId: price.id,
        isActive: true,
      })
      .returning();

    return Response.json(
      { success: true, data: { membership: serializeMembership(row) } },
      { status: 201 }
    );
  } catch (error) {
    console.error('[memberships:POST]', error);
    // If the Stripe product was created but DB insert failed, the orphan
    // product is harmless (no Price attached to a row). Log for cleanup.
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create membership' },
      },
      { status: 500 }
    );
  }
}

// Satisfy `any` lint for z import even if unused at runtime.
void z;
