import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { clientGroups, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/client-groups/:id
 *
 * Rename a client group.
 *
 * @body {string} name - New group name
 *
 * @returns {Object} Updated group
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'client-groups-update');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
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
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can update client groups' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'name is required' } },
        { status: 400 }
      );
    }

    // Check for duplicate name (excluding this group)
    const duplicate = await db.query.clientGroups.findFirst({
      where: (g, { and: andFn, eq: eqFn, ne }) =>
        andFn(eqFn(g.coachId, userId), eqFn(g.name, name), ne(g.id, groupId)),
      columns: { id: true },
    });

    if (duplicate) {
      return Response.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A group with this name already exists' } },
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(clientGroups)
      .set({ name })
      .where(and(eq(clientGroups.id, groupId), eq(clientGroups.coachId, userId)))
      .returning();

    if (!updated) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group not found' } },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: { group: { id: updated.id, name: updated.name, updatedAt: updated.updatedAt } } });
  } catch (error) {
    console.error('Error updating client group:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update client group' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/client-groups/:id
 *
 * Delete a client group. CASCADE handles member cleanup automatically.
 *
 * @returns {Object} Success confirmation
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'client-groups-delete');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
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
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can delete client groups' } },
        { status: 403 }
      );
    }

    const [deleted] = await db
      .delete(clientGroups)
      .where(and(eq(clientGroups.id, groupId), eq(clientGroups.coachId, userId)))
      .returning({ id: clientGroups.id });

    if (!deleted) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group not found' } },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting client group:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete client group' } },
      { status: 500 }
    );
  }
}
