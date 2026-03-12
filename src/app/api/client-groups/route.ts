import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { clientGroups, clientGroupMembers, users } from '@/db/schema';
import { eq, sql, asc, inArray } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/client-groups
 *
 * List all groups for the authenticated coach, with member counts, ordered alphabetically.
 *
 * @returns {Object} Array of groups with id, name, memberCount, createdAt
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'client-groups-list');
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
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can access client groups' } },
        { status: 403 }
      );
    }

    const groups = await db
      .select({
        id: clientGroups.id,
        name: clientGroups.name,
        createdAt: clientGroups.createdAt,
        memberCount: sql<number>`count(${clientGroupMembers.id})::int`,
      })
      .from(clientGroups)
      .leftJoin(clientGroupMembers, eq(clientGroupMembers.groupId, clientGroups.id))
      .where(eq(clientGroups.coachId, userId))
      .groupBy(clientGroups.id)
      .orderBy(asc(clientGroups.name));

    // Fetch clientIds per group so the frontend can filter clients into their groups
    const groupIds = groups.map((g) => g.id);
    const memberships =
      groupIds.length > 0
        ? await db
            .select({ groupId: clientGroupMembers.groupId, clientId: clientGroupMembers.clientId })
            .from(clientGroupMembers)
            .where(inArray(clientGroupMembers.groupId, groupIds))
        : [];

    const clientIdsByGroup = new Map<number, string[]>();
    for (const m of memberships) {
      const list = clientIdsByGroup.get(m.groupId) ?? [];
      list.push(m.clientId);
      clientIdsByGroup.set(m.groupId, list);
    }

    const groupsWithClientIds = groups.map((g) => ({
      ...g,
      clientIds: clientIdsByGroup.get(g.id) ?? [],
    }));

    return Response.json({ success: true, data: { groups: groupsWithClientIds } });
  } catch (error) {
    console.error('Error fetching client groups:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch client groups' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/client-groups
 *
 * Create a new client group for the authenticated coach.
 *
 * @body {string} name - Group name (non-empty, unique per coach)
 *
 * @returns {Object} Created group
 */
export async function POST(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'client-groups-create');
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
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can create client groups' } },
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

    // Check for duplicate name for this coach
    const existing = await db.query.clientGroups.findFirst({
      where: (g, { and, eq: eqFn }) => and(eqFn(g.coachId, userId), eqFn(g.name, name)),
      columns: { id: true },
    });

    if (existing) {
      return Response.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A group with this name already exists' } },
        { status: 409 }
      );
    }

    const [group] = await db
      .insert(clientGroups)
      .values({ coachId: userId, name })
      .returning();

    return Response.json({ success: true, data: { group: { id: group.id, name: group.name, createdAt: group.createdAt, memberCount: 0 } } }, { status: 201 });
  } catch (error) {
    console.error('Error creating client group:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create client group' } },
      { status: 500 }
    );
  }
}
