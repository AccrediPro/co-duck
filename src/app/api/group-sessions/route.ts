/**
 * @fileoverview Group Sessions API
 *
 * List and create group coaching sessions.
 *
 * @module api/group-sessions
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { groupSessions, users, coachProfiles } from '@/db/schema';
import { eq, desc, and, gte, sql, or, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/group-sessions
 *
 * List published group sessions (public) or all sessions for the authenticated coach.
 *
 * @query {string} [coachId] - Filter by coach
 * @query {string} [search] - Search title/description
 * @query {string} [upcoming=true] - Only show future sessions
 * @query {string} [mine] - "coach" to see own sessions (requires auth)
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page
 *
 * @returns Paginated group sessions
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const search = searchParams.get('search');
    const upcoming = searchParams.get('upcoming') !== 'false';
    const mine = searchParams.get('mine');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const conditions = [];

    // If requesting own sessions, require auth
    if (mine === 'coach') {
      const { userId } = await auth();
      if (!userId) {
        return Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }
      conditions.push(eq(groupSessions.coachId, userId));
    } else {
      // Public listing: only show published or full sessions
      conditions.push(or(eq(groupSessions.status, 'published'), eq(groupSessions.status, 'full')));
    }

    if (coachId) {
      conditions.push(eq(groupSessions.coachId, coachId));
    }

    if (search) {
      conditions.push(
        or(
          ilike(groupSessions.title, `%${search}%`),
          ilike(groupSessions.description, `%${search}%`)
        )
      );
    }

    if (upcoming) {
      conditions.push(gte(groupSessions.startTime, new Date()));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [sessionsResult, countResult] = await Promise.all([
      db
        .select()
        .from(groupSessions)
        .where(whereClause)
        .orderBy(desc(groupSessions.startTime))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(groupSessions)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count || 0;

    // Get coach info
    const coachIds = Array.from(new Set(sessionsResult.map((s) => s.coachId)));
    const coaches =
      coachIds.length > 0
        ? await db
            .select({
              userId: users.id,
              name: users.name,
              avatarUrl: users.avatarUrl,
              slug: coachProfiles.slug,
              headline: coachProfiles.headline,
            })
            .from(users)
            .innerJoin(coachProfiles, eq(users.id, coachProfiles.userId))
            .where(sql`${users.id} IN ${coachIds}`)
        : [];

    const coachMap = new Map(coaches.map((c) => [c.userId, c]));

    const formatted = sessionsResult.map((s) => {
      const coach = coachMap.get(s.coachId);
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        maxParticipants: s.maxParticipants,
        participantCount: s.participantCount,
        spotsRemaining: s.maxParticipants - s.participantCount,
        priceCents: s.priceCents,
        currency: s.currency,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.duration,
        status: s.status,
        tags: s.tags,
        meetingLink: mine === 'coach' ? s.meetingLink : undefined,
        coach: coach
          ? {
              id: coach.userId,
              name: coach.name,
              avatarUrl: coach.avatarUrl,
              slug: coach.slug,
              headline: coach.headline,
            }
          : null,
        createdAt: s.createdAt,
      };
    });

    return Response.json({
      success: true,
      data: {
        sessions: formatted,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Error fetching group sessions:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch group sessions' },
      },
      { status: 500 }
    );
  }
}

const createGroupSessionSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  maxParticipants: z.number().int().min(2).max(100).default(10),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3).default('usd'),
  startTime: z.string().datetime(),
  duration: z.number().int().min(15).max(480),
  meetingLink: z.string().url().optional(),
  tags: z.array(z.string()).max(10).optional(),
  status: z.enum(['draft', 'published']).default('draft'),
});

/**
 * POST /api/group-sessions
 *
 * Create a new group coaching session (coach only).
 *
 * @body {string} title - Session title
 * @body {string} [description] - Session description
 * @body {number} [maxParticipants=10] - Max participants
 * @body {number} priceCents - Price per participant in cents
 * @body {string} startTime - ISO datetime
 * @body {number} duration - Duration in minutes
 * @body {string} [meetingLink] - Meeting URL
 * @body {string[]} [tags] - Topic tags
 * @body {string} [status=draft] - "draft" or "published"
 *
 * @returns Created group session
 */
export async function POST(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'group-sessions-create');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    // Verify user is a coach
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user || user.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can create group sessions' },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createGroupSessionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
        },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      maxParticipants,
      priceCents,
      currency,
      startTime,
      duration,
      meetingLink,
      tags,
      status,
    } = parsed.data;

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const [newSession] = await db
      .insert(groupSessions)
      .values({
        coachId: userId,
        title,
        description: description || null,
        maxParticipants,
        priceCents,
        currency,
        startTime: start,
        endTime: end,
        duration,
        meetingLink: meetingLink || null,
        tags: tags || null,
        status,
      })
      .returning();

    return Response.json({
      success: true,
      data: {
        id: newSession.id,
        title: newSession.title,
        description: newSession.description,
        maxParticipants: newSession.maxParticipants,
        priceCents: newSession.priceCents,
        currency: newSession.currency,
        startTime: newSession.startTime,
        endTime: newSession.endTime,
        duration: newSession.duration,
        status: newSession.status,
        tags: newSession.tags,
        createdAt: newSession.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating group session:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create group session' },
      },
      { status: 500 }
    );
  }
}
