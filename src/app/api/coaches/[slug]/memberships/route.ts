/**
 * @fileoverview GET /api/coaches/[slug]/memberships
 *
 * Public listing of a coach's active memberships, for the "Ongoing coaching"
 * section on the public profile page.
 *
 * @module api/coaches/[slug]/memberships
 */

import { db } from '@/db';
import { memberships, coachProfiles } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { serializeMembership } from '@/lib/serializers/memberships';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'coach-memberships-list');
  if (!rl.success) return rateLimitResponse(rl);

  const { slug } = await params;

  try {
    const profile = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.slug, slug),
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
      .orderBy(desc(memberships.monthlyPriceCents));

    return Response.json({
      success: true,
      data: { memberships: rows.map(serializeMembership) },
    });
  } catch (error) {
    console.error('[coaches/[slug]/memberships:GET]', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch memberships' },
      },
      { status: 500 }
    );
  }
}
