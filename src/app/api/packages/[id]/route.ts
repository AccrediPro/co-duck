/**
 * GET /api/packages/[id]  — get a single package
 * PATCH /api/packages/[id] — coach-only: update
 * DELETE /api/packages/[id] — coach-only: delete (only if no active purchases)
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { packages, packagePurchases } from '@/db/schema';
import { and, eq, count } from 'drizzle-orm';
import { z } from 'zod';
import { canCreatePackage } from '@/lib/plan-limits';

const updatePackageSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().max(1000).optional().nullable(),
  sessionCount: z.number().int().min(2).max(50).optional(),
  sessionDuration: z.number().int().min(15).max(180).optional(),
  priceCents: z.number().int().min(100).optional(),
  originalPriceCents: z.number().int().min(100).optional().nullable(),
  validityDays: z.number().int().min(30).max(730).optional(),
  isPublished: z.boolean().optional(),
  sessionTypeId: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packageId = parseInt(id);
  if (isNaN(packageId)) {
    return Response.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid package ID' } },
      { status: 400 }
    );
  }

  const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1);

  if (!pkg) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Package not found' } },
      { status: 404 }
    );
  }

  return Response.json({ success: true, data: pkg });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const packageId = parseInt(id);
  if (isNaN(packageId)) {
    return Response.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid package ID' } },
      { status: 400 }
    );
  }

  const [pkg] = await db
    .select({ coachId: packages.coachId, isPublished: packages.isPublished })
    .from(packages)
    .where(eq(packages.id, packageId))
    .limit(1);

  if (!pkg) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Package not found' } },
      { status: 404 }
    );
  }

  if (pkg.coachId !== userId) {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not your package' } },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = updatePackageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 }
    );
  }

  // If publishing for first time, check plan limits
  if (parsed.data.isPublished && !pkg.isPublished) {
    const limitCheck = await canCreatePackage(userId);
    if (!limitCheck.allowed) {
      return Response.json(
        { success: false, error: { code: 'PLAN_LIMIT_EXCEEDED', message: limitCheck.reason } },
        { status: 403 }
      );
    }
  }

  const [updated] = await db
    .update(packages)
    .set(parsed.data)
    .where(and(eq(packages.id, packageId), eq(packages.coachId, userId)))
    .returning();

  return Response.json({ success: true, data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const packageId = parseInt(id);
  if (isNaN(packageId)) {
    return Response.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid package ID' } },
      { status: 400 }
    );
  }

  const [pkg] = await db
    .select({ coachId: packages.coachId })
    .from(packages)
    .where(eq(packages.id, packageId))
    .limit(1);

  if (!pkg) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Package not found' } },
      { status: 404 }
    );
  }

  if (pkg.coachId !== userId) {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not your package' } },
      { status: 403 }
    );
  }

  // Block deletion if there are active purchases
  const [{ value: activePurchases }] = await db
    .select({ value: count() })
    .from(packagePurchases)
    .where(and(eq(packagePurchases.packageId, packageId), eq(packagePurchases.status, 'active')));

  if (activePurchases > 0) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Cannot delete a package with active purchases. Unpublish it instead.',
        },
      },
      { status: 409 }
    );
  }

  await db.delete(packages).where(and(eq(packages.id, packageId), eq(packages.coachId, userId)));

  return Response.json({ success: true, data: null });
}
