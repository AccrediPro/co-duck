import { db } from '@/db';
import { coachInvites, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'admin-coach-invites');
  if (!rl.success) return rateLimitResponse(rl);

  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const invites = await db
      .select({
        id: coachInvites.id,
        email: coachInvites.email,
        status: coachInvites.status,
        createdAt: coachInvites.createdAt,
        claimedAt: coachInvites.claimedAt,
        inviterName: users.name,
        inviterEmail: users.email,
      })
      .from(coachInvites)
      .leftJoin(users, eq(coachInvites.invitedBy, users.id))
      .where(eq(coachInvites.status, 'pending'))
      .orderBy(desc(coachInvites.createdAt));

    return Response.json({
      success: true,
      data: { invites },
    });
  } catch (error) {
    console.error('Error fetching coach invites:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch invites' } },
      { status: 500 }
    );
  }
}
