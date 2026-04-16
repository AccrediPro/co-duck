/**
 * GET /api/me/subscription
 *
 * Returns the authenticated coach's current subscription plan and status.
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { coachSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPlanById } from '@/lib/plan-limits';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const [sub] = await db
    .select()
    .from(coachSubscriptions)
    .where(eq(coachSubscriptions.coachId, userId))
    .limit(1);

  if (!sub) {
    // No subscription record = free/no plan
    return Response.json({
      success: true,
      data: {
        planId: 'starter',
        plan: getPlanById('starter'),
        status: null,
        subscription: null,
      },
    });
  }

  return Response.json({
    success: true,
    data: {
      planId: sub.planId,
      plan: getPlanById(sub.planId),
      status: sub.status,
      subscription: sub,
    },
  });
}
