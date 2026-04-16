/**
 * GET /api/coaches/[slug]/packages — public list of published packages for a coach
 * POST /api/coaches/[slug]/packages — coach-only: create a new package
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { packages, coachProfiles, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { canCreatePackage } from '@/lib/plan-limits';

const createPackageSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(1000).optional(),
  sessionCount: z.number().int().min(2).max(50),
  sessionDuration: z.number().int().min(15).max(180),
  priceCents: z.number().int().min(100),
  originalPriceCents: z.number().int().min(100).optional(),
  validityDays: z.number().int().min(30).max(730).default(180),
  isPublished: z.boolean().default(false),
  sessionTypeId: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const coach = await db
    .select({ userId: coachProfiles.userId })
    .from(coachProfiles)
    .where(and(eq(coachProfiles.slug, slug), eq(coachProfiles.isPublished, true)))
    .limit(1);

  if (!coach[0]) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Coach not found' } },
      { status: 404 }
    );
  }

  const result = await db
    .select()
    .from(packages)
    .where(and(eq(packages.coachId, coach[0].userId), eq(packages.isPublished, true)))
    .orderBy(packages.priceCents);

  return Response.json({ success: true, data: result });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { slug } = await params;

  // Verify the coach owns this slug
  const coach = await db
    .select({ userId: coachProfiles.userId })
    .from(coachProfiles)
    .where(and(eq(coachProfiles.slug, slug), eq(coachProfiles.userId, userId)))
    .limit(1);

  if (!coach[0]) {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not your coach profile' } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = createPackageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 }
    );
  }

  // Check plan limits
  if (parsed.data.isPublished) {
    const limitCheck = await canCreatePackage(userId);
    if (!limitCheck.allowed) {
      return Response.json(
        { success: false, error: { code: 'PLAN_LIMIT_EXCEEDED', message: limitCheck.reason } },
        { status: 403 }
      );
    }
  }

  const [created] = await db
    .insert(packages)
    .values({
      coachId: userId,
      ...parsed.data,
    })
    .returning();

  return Response.json({ success: true, data: created }, { status: 201 });
}
