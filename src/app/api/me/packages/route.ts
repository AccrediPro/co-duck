/**
 * GET /api/me/packages
 *
 * Returns all package purchases for the authenticated client,
 * including remaining sessions and expiration info.
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { packagePurchases, packages } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const purchases = await db
    .select({
      id: packagePurchases.id,
      status: packagePurchases.status,
      purchasedAt: packagePurchases.purchasedAt,
      expiresAt: packagePurchases.expiresAt,
      totalSessions: packagePurchases.totalSessions,
      usedSessions: packagePurchases.usedSessions,
      totalPaidCents: packagePurchases.totalPaidCents,
      packageId: packagePurchases.packageId,
      coachId: packagePurchases.coachId,
      packageTitle: packages.title,
      packageSessionDuration: packages.sessionDuration,
    })
    .from(packagePurchases)
    .innerJoin(packages, eq(packagePurchases.packageId, packages.id))
    .where(eq(packagePurchases.clientId, userId))
    .orderBy(desc(packagePurchases.purchasedAt));

  const data = purchases.map((p) => ({
    ...p,
    remainingSessions: p.totalSessions - p.usedSessions,
    isExpired: new Date(p.expiresAt) < new Date(),
  }));

  return Response.json({ success: true, data });
}
