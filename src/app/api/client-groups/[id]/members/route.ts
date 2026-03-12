import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { clientGroups, clientGroupMembers, users } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/client-groups/:id/members
 *
 * List all clients in a group (name, email, avatarUrl), ordered alphabetically.
 *
 * @returns {Object} Array of client members
 */
export async function GET(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'client-group-members-list');
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
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can view group members' } },
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

    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        addedAt: clientGroupMembers.createdAt,
      })
      .from(clientGroupMembers)
      .innerJoin(users, eq(users.id, clientGroupMembers.clientId))
      .where(eq(clientGroupMembers.groupId, groupId))
      .orderBy(asc(users.name));

    return Response.json({ success: true, data: { members } });
  } catch (error) {
    console.error('Error fetching group members:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch group members' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/client-groups/:id/members
 *
 * Add a client to a group.
 *
 * @body {string} clientId - User ID of the client to add
 *
 * @returns {Object} Created membership
 */
export async function POST(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'client-group-members-add');
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
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can add members to groups' } },
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

    const body = await request.json();
    const clientId = typeof body?.clientId === 'string' ? body.clientId.trim() : '';

    if (!clientId) {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'clientId is required' } },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = await db.query.users.findFirst({
      where: eq(users.id, clientId),
      columns: { id: true },
    });

    if (!client) {
      return Response.json(
        { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      );
    }

    // Check for duplicate membership
    const existing = await db.query.clientGroupMembers.findFirst({
      where: and(eq(clientGroupMembers.groupId, groupId), eq(clientGroupMembers.clientId, clientId)),
      columns: { id: true },
    });

    if (existing) {
      return Response.json(
        { success: false, error: { code: 'ALREADY_MEMBER', message: 'Client is already in this group' } },
        { status: 409 }
      );
    }

    const [membership] = await db
      .insert(clientGroupMembers)
      .values({ groupId, clientId })
      .returning();

    return Response.json(
      { success: true, data: { membership: { id: membership.id, groupId: membership.groupId, clientId: membership.clientId, createdAt: membership.createdAt } } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding group member:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add group member' } },
      { status: 500 }
    );
  }
}
