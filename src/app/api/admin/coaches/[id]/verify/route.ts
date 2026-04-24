/**
 * @fileoverview Admin Coach Verification API
 *
 * Approve or reject coach profiles (admin only).
 *
 * @module api/admin/coaches/[id]/verify
 */

import { db } from '@/db';
import { coachProfiles, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { z } from 'zod';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import { VerificationEmail } from '@/lib/emails';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const verifySchema = z.object({
  status: z.enum(['verified', 'rejected']),
  notes: z.string().max(2000).optional(),
});

/**
 * PATCH /api/admin/coaches/:id/verify
 *
 * Approve or reject a coach's verification status.
 *
 * @param {string} id - Coach's user ID
 * @body {string} status - "verified" or "rejected"
 * @body {string} [notes] - Optional admin notes
 *
 * @returns Updated coach profile
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'admin-coaches-verify');
  if (!rl.success) return rateLimitResponse(rl);

  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const { id: coachUserId } = await params;
    const body = await request.json();

    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
        },
        { status: 400 }
      );
    }

    const { status, notes } = parsed.data;

    // Get coach profile
    const profile = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, coachUserId),
    });

    if (!profile) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Coach profile not found' } },
        { status: 404 }
      );
    }

    // Update verification status
    const [updated] = await db
      .update(coachProfiles)
      .set({ verificationStatus: status })
      .where(eq(coachProfiles.userId, coachUserId))
      .returning();

    // Notify the coach
    const coach = await db.query.users.findFirst({
      where: eq(users.id, coachUserId),
    });

    if (coach) {
      const isApproved = status === 'verified';
      createNotification({
        userId: coachUserId,
        type: 'system',
        title: isApproved ? 'Profile verified!' : 'Profile verification update',
        body: isApproved
          ? 'Your coach profile has been verified. You now have a verification badge.'
          : `Your profile verification was not approved.${notes ? ` Reason: ${notes}` : ''}`,
        link: '/dashboard/profile',
      });

      // Send verification email (non-blocking)
      sendEmail({
        to: coach.email,
        subject: isApproved
          ? 'Your AccrediPro CoachHub profile has been verified!'
          : 'Update on your AccrediPro CoachHub profile verification',
        react: VerificationEmail({
          coachName: coach.name || 'Coach',
          status,
          notes: notes || undefined,
          unsubscribeUrl: getUnsubscribeUrl(coachUserId, 'marketing'),
        }),
      }).catch((err) => console.error('Failed to send verification email:', err));
    }

    return Response.json({
      success: true,
      data: {
        userId: updated.userId,
        verificationStatus: updated.verificationStatus,
        slug: updated.slug,
        headline: updated.headline,
      },
    });
  } catch (error) {
    console.error('Error verifying coach:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update verification' },
      },
      { status: 500 }
    );
  }
}
