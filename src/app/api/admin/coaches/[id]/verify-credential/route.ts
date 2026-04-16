/**
 * @fileoverview Admin Credential Verification API
 *
 * Verify or unverify individual coach credentials.
 * Admin only.
 *
 * @module api/admin/coaches/[id]/verify-credential
 */

import { NextRequest } from 'next/server';
import { db, coachProfiles } from '@/db';
import type { Credential } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { adminVerifyCredentialSchema } from '@/lib/validators/coach-onboarding';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/coaches/:id/verify-credential
 *
 * Verify or unverify a specific credential by its ID.
 *
 * @body {string} coachId - Coach user ID
 * @body {string} credentialId - UUID of the credential to verify
 * @body {'verify' | 'unverify'} action - The action to take
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'admin-verify-credential');
  if (!rl.success) return rateLimitResponse(rl);

  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const { id: coachUserId } = await params;
    const body = await request.json();

    const parsed = adminVerifyCredentialSchema.safeParse({ ...body, coachId: coachUserId });
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
        },
        { status: 400 }
      );
    }

    const { credentialId, action } = parsed.data;
    const adminId = auth.userId;

    const profile = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, coachUserId),
    });

    if (!profile) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Coach profile not found' } },
        { status: 404 }
      );
    }

    const credentials = (profile.credentials as Credential[]) || [];
    const credIndex = credentials.findIndex((c) => c.id === credentialId);

    if (credIndex === -1) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Credential not found' } },
        { status: 404 }
      );
    }

    const updatedCredentials: Credential[] = credentials.map((c, i) => {
      if (i !== credIndex) return c;
      if (action === 'verify') {
        return { ...c, verifiedAt: new Date().toISOString(), verifiedBy: adminId };
      } else {
        const { verifiedAt: _va, verifiedBy: _vb, ...rest } = c;
        return rest as Credential;
      }
    });

    await db
      .update(coachProfiles)
      .set({ credentials: updatedCredentials })
      .where(eq(coachProfiles.userId, coachUserId));

    return Response.json({
      success: true,
      data: { credentialId, action, credentials: updatedCredentials },
    });
  } catch (error) {
    console.error('Error verifying credential:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update credential' },
      },
      { status: 500 }
    );
  }
}
