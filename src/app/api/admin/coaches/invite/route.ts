import { db } from '@/db';
import { coachInvites, coachProfiles, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'admin-coach-invite');
  if (!rl.success) return rateLimitResponse(rl);

  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !EMAIL_REGEX.test(email)) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_EMAIL', message: 'Please provide a valid email address' },
        },
        { status: 400 }
      );
    }

    // Check if already invited
    const existingInvite = await db.query.coachInvites.findFirst({
      where: eq(coachInvites.email, email),
    });

    if (existingInvite) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'ALREADY_INVITED',
            message:
              existingInvite.status === 'claimed'
                ? 'This email has already been invited and claimed'
                : 'This email has already been invited',
          },
        },
        { status: 409 }
      );
    }

    // Check if user already exists in DB
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      // User exists — change role to coach directly
      if (existingUser.role === 'coach') {
        return Response.json(
          {
            success: false,
            error: { code: 'ALREADY_COACH', message: 'This user is already a coach' },
          },
          { status: 409 }
        );
      }

      await db.update(users).set({ role: 'coach' }).where(eq(users.id, existingUser.id));

      // Create coach_profile if needed
      const existingProfile = await db.query.coachProfiles.findFirst({
        where: eq(coachProfiles.userId, existingUser.id),
      });

      if (!existingProfile) {
        const slug = generateSlug(existingUser.name, email);
        await db
          .insert(coachProfiles)
          .values({ userId: existingUser.id, slug })
          .onConflictDoNothing();
      }

      // Record the invite as already claimed
      await db.insert(coachInvites).values({
        email,
        status: 'claimed',
        invitedBy: auth.userId!,
        claimedAt: new Date(),
      });

      return Response.json({
        success: true,
        data: {
          type: 'existing_user_promoted',
          message: `${existingUser.name || email} has been promoted to coach`,
        },
      });
    }

    // User doesn't exist yet — create pending invite
    const [invite] = await db
      .insert(coachInvites)
      .values({
        email,
        invitedBy: auth.userId!,
      })
      .returning();

    return Response.json(
      {
        success: true,
        data: {
          type: 'invite_created',
          invite: {
            id: invite.id,
            email: invite.email,
            status: invite.status,
            createdAt: invite.createdAt,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating coach invite:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create invite' } },
      { status: 500 }
    );
  }
}

function generateSlug(name: string | null, email: string): string {
  const base = name || email.split('@')[0];
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${suffix}`;
}
