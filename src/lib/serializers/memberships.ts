/**
 * @fileoverview Shared JSON shape for the `memberships` table.
 *
 * Kept out of the route file itself because Next.js App Router forbids
 * exporting non-HTTP-method symbols from `route.ts`. All membership API
 * routes (GET list, GET by id, POST, PATCH, DELETE, public-by-slug) pass
 * rows through this function so the wire format stays consistent.
 */

import type { memberships } from '@/db/schema';

export type MembershipRow = typeof memberships.$inferSelect;

/**
 * Projects a raw DB row onto the public JSON shape.
 *
 * Specifically this excludes the `stripeProductId` / `stripePriceId`
 * columns — those are internal plumbing, not something the client needs
 * to see.
 */
export function serializeMembership(row: MembershipRow) {
  return {
    id: row.id,
    coachId: row.coachId,
    name: row.name,
    description: row.description,
    monthlyPriceCents: row.monthlyPriceCents,
    currency: row.currency,
    sessionsPerPeriod: row.sessionsPerPeriod,
    includesMessaging: row.includesMessaging,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
