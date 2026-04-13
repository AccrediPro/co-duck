import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { clientGroups, clientGroupMembers, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/groups
 *
 * Return all groups a client belongs to, scoped to the authenticated coach.
 *
 * @returns {Object} Array of groups: [{id, name}]
 */
export async function GET(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'client-groups-by-client');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can view client groups' },
        },
        { status: 403 }
      );
    }

    const { clientId } = await params;

    const groups = await db
      .select({
        id: clientGroups.id,
        name: clientGroups.name,
      })
      .from(clientGroupMembers)
      .innerJoin(clientGroups, eq(clientGroups.id, clientGroupMembers.groupId))
      .where(and(eq(clientGroupMembers.clientId, clientId), eq(clientGroups.coachId, userId)))
      .orderBy(clientGroups.name);

    return Response.json({ success: true, data: { groups } });
  } catch (error) {
    console.error('Error fetching client groups:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch client groups' },
      },
      { status: 500 }
    );
  }
}
