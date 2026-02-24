/**
 * @fileoverview Group Session Detail API
 *
 * Get, update, and manage individual group sessions.
 *
 * @module api/group-sessions/[id]
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { groupSessions, groupSessionParticipants, users, coachProfiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/group-sessions/:id
 *
 * Get group session details. Public for published sessions.
 * Coach sees full details including meeting link and participant list.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);

    if (isNaN(sessionId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid session ID' } },
        { status: 400 }
      );
    }

    const session = await db.query.groupSessions.findFirst({
      where: eq(groupSessions.id, sessionId),
    });

    if (!session) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group session not found' } },
        { status: 404 }
      );
    }

    const { userId } = await auth();
    const isCoach = userId === session.coachId;
    const isParticipant = userId
      ? await db.query.groupSessionParticipants.findFirst({
          where: and(
            eq(groupSessionParticipants.groupSessionId, sessionId),
            eq(groupSessionParticipants.clientId, userId),
            eq(groupSessionParticipants.status, 'registered')
          ),
        })
      : null;

    // Only show published/full to non-coach users
    if (!isCoach && session.status !== 'published' && session.status !== 'full') {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group session not found' } },
        { status: 404 }
      );
    }

    // Get coach info
    const coach = await db
      .select({
        name: users.name,
        avatarUrl: users.avatarUrl,
        slug: coachProfiles.slug,
        headline: coachProfiles.headline,
      })
      .from(users)
      .innerJoin(coachProfiles, eq(users.id, coachProfiles.userId))
      .where(eq(users.id, session.coachId))
      .limit(1);

    // Get participant list (for coach only)
    let participants = null;
    if (isCoach) {
      const participantRows = await db
        .select({
          id: groupSessionParticipants.id,
          clientId: groupSessionParticipants.clientId,
          status: groupSessionParticipants.status,
          registeredAt: groupSessionParticipants.registeredAt,
          clientName: users.name,
          clientEmail: users.email,
          clientAvatarUrl: users.avatarUrl,
        })
        .from(groupSessionParticipants)
        .innerJoin(users, eq(groupSessionParticipants.clientId, users.id))
        .where(eq(groupSessionParticipants.groupSessionId, sessionId));

      participants = participantRows;
    }

    return Response.json({
      success: true,
      data: {
        id: session.id,
        title: session.title,
        description: session.description,
        maxParticipants: session.maxParticipants,
        participantCount: session.participantCount,
        spotsRemaining: session.maxParticipants - session.participantCount,
        priceCents: session.priceCents,
        currency: session.currency,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        meetingLink: isCoach || isParticipant ? session.meetingLink : null,
        status: session.status,
        tags: session.tags,
        coach: coach[0] || null,
        participants,
        isCoach,
        isRegistered: !!isParticipant,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching group session:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch group session' },
      },
      { status: 500 }
    );
  }
}

const updateGroupSessionSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  maxParticipants: z.number().int().min(2).max(100).optional(),
  priceCents: z.number().int().min(0).optional(),
  meetingLink: z.string().url().optional().nullable(),
  tags: z.array(z.string()).max(10).optional(),
  status: z.enum(['draft', 'published', 'cancelled']).optional(),
});

/**
 * PATCH /api/group-sessions/:id
 *
 * Update a group session (coach only).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const sessionId = parseInt(id);

    if (isNaN(sessionId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid session ID' } },
        { status: 400 }
      );
    }

    const session = await db.query.groupSessions.findFirst({
      where: and(eq(groupSessions.id, sessionId), eq(groupSessions.coachId, userId)),
    });

    if (!session) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group session not found' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateGroupSessionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.maxParticipants !== undefined)
      updateData.maxParticipants = parsed.data.maxParticipants;
    if (parsed.data.priceCents !== undefined) updateData.priceCents = parsed.data.priceCents;
    if (parsed.data.meetingLink !== undefined) updateData.meetingLink = parsed.data.meetingLink;
    if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { success: false, error: { code: 'NO_UPDATES', message: 'No valid updates provided' } },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(groupSessions)
      .set(updateData)
      .where(eq(groupSessions.id, sessionId))
      .returning();

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        maxParticipants: updated.maxParticipants,
        participantCount: updated.participantCount,
        priceCents: updated.priceCents,
        status: updated.status,
        tags: updated.tags,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating group session:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update group session' },
      },
      { status: 500 }
    );
  }
}
