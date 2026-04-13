import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, bookings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/:id/profile
 *
 * Returns a user's public profile for coaches to view their clients.
 * Requires the requester to be a coach with at least one booking with this user.
 * Excludes sensitive fields (email, phone, dateOfBirth) for privacy.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'users-id-profile-get');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id: targetUserId } = await params;

    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can view client profiles' },
        },
        { status: 403 }
      );
    }

    // Check that the coach has at least one booking with this user
    const sharedBooking = await db.query.bookings.findFirst({
      where: and(eq(bookings.coachId, userId), eq(bookings.clientId, targetUserId)),
    });

    if (!sharedBooking) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only view profiles of clients you have bookings with',
          },
        },
        { status: 403 }
      );
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!targetUser) {
      return Response.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: {
        id: targetUser.id,
        name: targetUser.name,
        avatarUrl: targetUser.avatarUrl,
        bio: targetUser.bio,
        city: targetUser.city,
        occupation: targetUser.occupation,
        goals: targetUser.goals,
        createdAt: targetUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch profile' } },
      { status: 500 }
    );
  }
}
