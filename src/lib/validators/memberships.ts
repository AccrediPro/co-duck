/**
 * @fileoverview Membership Validation Schemas
 *
 * Zod schemas for the recurring-retainer "Memberships" feature.
 *
 * Covers:
 * - Coach-side CRUD on memberships (create/update)
 * - Client-side subscription lifecycle (cancel)
 *
 * All monetary values are in CENTS. Public API surfaces accept and return
 * cents exclusively — the UI layer is responsible for dollar conversion.
 *
 * @module validators/memberships
 */

import { z } from 'zod';

// ============================================================================
// CONSTRAINTS
// ============================================================================

/** Minimum price for a membership (avoid Stripe rejecting trivial amounts). */
export const MIN_MEMBERSHIP_PRICE_CENTS = 500; // $5.00

/** Upper bound that keeps the product sensible (catches accidental zeros). */
export const MAX_MEMBERSHIP_PRICE_CENTS = 10_000_000; // $100,000.00

/** Minimum sessions per period. 0 = messaging-only tier. */
export const MIN_SESSIONS_PER_PERIOD = 0;

/** Upper bound on sessions per period (sanity check, not a product limit). */
export const MAX_SESSIONS_PER_PERIOD = 60;

/** Currencies mirrored from coach-onboarding validators (keep in sync). */
const SUPPORTED_CURRENCIES = [
  'usd',
  'eur',
  'gbp',
  'cad',
  'aud',
  'nzd',
  'chf',
  'inr',
  'jpy',
  'sgd',
] as const;

// ============================================================================
// CREATE MEMBERSHIP
// ============================================================================

/**
 * Payload a coach sends to `POST /api/memberships`.
 *
 * We intentionally DO NOT accept `stripeProductId` / `stripePriceId` from
 * the client — the server creates those during request handling.
 */
export const createMembershipSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be 100 characters or fewer'),

  description: z
    .string()
    .trim()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  monthlyPriceCents: z
    .number()
    .int('Price must be an integer number of cents')
    .min(MIN_MEMBERSHIP_PRICE_CENTS, `Minimum price is ${MIN_MEMBERSHIP_PRICE_CENTS} cents`)
    .max(MAX_MEMBERSHIP_PRICE_CENTS, `Maximum price is ${MAX_MEMBERSHIP_PRICE_CENTS} cents`),

  currency: z
    .enum(SUPPORTED_CURRENCIES)
    .optional()
    .default('usd'),

  sessionsPerPeriod: z
    .number()
    .int('Sessions per period must be an integer')
    .min(MIN_SESSIONS_PER_PERIOD)
    .max(MAX_SESSIONS_PER_PERIOD),

  includesMessaging: z.boolean().optional().default(true),
});

export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;

// ============================================================================
// UPDATE MEMBERSHIP
// ============================================================================

/**
 * Payload a coach sends to `PATCH /api/memberships/[id]`.
 *
 * Updates are partial. Changing `monthlyPriceCents` causes the server to
 * create a new Stripe Price and rotate the pointer — existing subscriptions
 * keep their original price until explicitly migrated.
 *
 * We do NOT allow changing `sessionsPerPeriod` here because it would
 * retroactively break the allotment contract for active subscribers.
 * (A future migration tool can handle that case explicitly.)
 */
export const updateMembershipSchema = z
  .object({
    name: z.string().trim().min(3).max(100).optional(),
    description: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional(),
    monthlyPriceCents: z
      .number()
      .int()
      .min(MIN_MEMBERSHIP_PRICE_CENTS)
      .max(MAX_MEMBERSHIP_PRICE_CENTS)
      .optional(),
    includesMessaging: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;

// ============================================================================
// SUBSCRIBE
// ============================================================================

/**
 * Payload a client sends to `POST /api/memberships/[id]/subscribe`.
 *
 * Just carries the redirect URL template the client wants Stripe to come
 * back to. The server embeds `{CHECKOUT_SESSION_ID}` into the success URL
 * so the confirmation page can look the subscription up.
 */
export const subscribeToMembershipSchema = z.object({
  /** Optional URL to return to after successful Checkout. */
  successUrl: z.string().url().optional(),
  /** Optional URL to return to if the client abandons Checkout. */
  cancelUrl: z.string().url().optional(),
});

export type SubscribeToMembershipInput = z.infer<typeof subscribeToMembershipSchema>;

// ============================================================================
// CANCEL SUBSCRIPTION
// ============================================================================

/**
 * Payload a client sends to `POST /api/memberships/subscriptions/[id]/cancel`.
 *
 * Default (`immediate=false`) cancels at period end — client keeps access
 * until the current billing period rolls over. `immediate=true` is reserved
 * for unusual cases (coach deactivation, abuse) and may incur no refund.
 */
export const cancelSubscriptionSchema = z.object({
  immediate: z.boolean().optional().default(false),
  reason: z.string().trim().max(500).optional(),
});

export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
