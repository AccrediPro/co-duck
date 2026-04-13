import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { clientGroups, clientGroupMembers, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string; clientId: string }>;
}

/**
 * DELETE /api/client-groups/:id/members/:clientId
 *
 * Remove a client from a group.
 *
 * @returns {Object} Success confirmation
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'client-group-members-remove');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id, clientId } = await params;
    const groupId = parseInt(id);

    if (isNaN(groupId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid group ID' } },
        { status: 400 }
      );
    }

    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can remove members from groups' },
        },
        { status: 403 }
      );
    }

    // Verify group belongs to this coach
    const group = await db.query.clientGroups.findFirst({
      where: and(eq(clientGroups.id, groupId), eq(clientGroups.coachId, userId)),
      columns: { id: true },
    });

    if (!group) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group not found' } },
        { status: 404 }
      );
    }

    const [deleted] = await db
      .delete(clientGroupMembers)
      .where(
        and(eq(clientGroupMembers.groupId, groupId), eq(clientGroupMembers.clientId, clientId))
      )
      .returning({ id: clientGroupMembers.id });

    if (!deleted) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Member not found in this group' } },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error removing group member:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove group member' },
      },
      { status: 500 }
    );
  }
}
