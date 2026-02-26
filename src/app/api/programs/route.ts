import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { programs, users, bookings, goals } from '@/db/schema';
import { eq, and, desc, or, inArray, sql } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const coachId = searchParams.get('coachId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const conditions = [];

    // Access control: user must be coach or client on the program
    if (clientId) {
      // Coach filtering by client
      conditions.push(eq(programs.coachId, userId));
      conditions.push(eq(programs.clientId, clientId));
    } else if (coachId) {
      // Client filtering by coach
      conditions.push(eq(programs.clientId, userId));
      conditions.push(eq(programs.coachId, coachId));
    } else {
      // Default: show all programs where user is coach or client
      conditions.push(or(eq(programs.coachId, userId), eq(programs.clientId, userId)));
    }

    if (status) {
      conditions.push(eq(programs.status, status as 'active' | 'completed' | 'archived'));
    }

    const allPrograms = await db
      .select()
      .from(programs)
      .where(and(...conditions))
      .orderBy(desc(programs.createdAt));

    const total = allPrograms.length;
    const paginatedPrograms = allPrograms.slice(offset, offset + limit);

    // Get user info for coaches and clients
    const userIds = Array.from(
      new Set(paginatedPrograms.flatMap((p) => [p.coachId, p.clientId]))
    );
    const usersData = userIds.length
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const usersMap = new Map(usersData.map((u) => [u.id, u]));

    // Get goals count per program
    const programIds = paginatedPrograms.map((p) => p.id);
    const goalsCountResult = programIds.length
      ? await db
          .select({
            programId: goals.programId,
            total: sql<number>`count(*)`.as('total'),
            completed: sql<number>`count(*) filter (where ${goals.status} = 'completed')`.as(
              'completed'
            ),
          })
          .from(goals)
          .where(inArray(goals.programId, programIds))
          .groupBy(goals.programId)
      : [];
    const goalsMap = new Map(goalsCountResult.map((g) => [g.programId, g]));

    const formattedPrograms = paginatedPrograms.map((program) => {
      const coach = usersMap.get(program.coachId);
      const client = usersMap.get(program.clientId);
      const goalStats = goalsMap.get(program.id);

      return {
        id: program.id,
        title: program.title,
        description: program.description,
        status: program.status,
        startDate: program.startDate,
        endDate: program.endDate,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
        coach: coach
          ? { id: coach.id, name: coach.name, avatarUrl: coach.avatarUrl }
          : null,
        client: client
          ? { id: client.id, name: client.name, avatarUrl: client.avatarUrl }
          : null,
        goalsCount: goalStats ? Number(goalStats.total) : 0,
        goalsCompleted: goalStats ? Number(goalStats.completed) : 0,
        isCoach: program.coachId === userId,
      };
    });

    return Response.json({
      success: true,
      data: {
        programs: formattedPrograms,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Error fetching programs:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch programs' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'programs-create');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { clientId, title, description, startDate, endDate } = body;

    if (!clientId || !title) {
      return Response.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'clientId and title are required' },
        },
        { status: 400 }
      );
    }

    // Verify user is a coach
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can create programs' },
        },
        { status: 403 }
      );
    }

    // Verify coach has a confirmed/completed booking with this client
    const hasBooking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.coachId, userId),
        eq(bookings.clientId, clientId),
        inArray(bookings.status, ['confirmed', 'completed'])
      ),
    });

    if (!hasBooking) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'NO_RELATIONSHIP',
            message: 'You must have a confirmed booking with this client to create a program',
          },
        },
        { status: 403 }
      );
    }

    // Validate dates if provided
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_DATE', message: 'startDate must be in YYYY-MM-DD format' },
        },
        { status: 400 }
      );
    }
    if (endDate && !dateRegex.test(endDate)) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_DATE', message: 'endDate must be in YYYY-MM-DD format' },
        },
        { status: 400 }
      );
    }

    const [newProgram] = await db
      .insert(programs)
      .values({
        coachId: userId,
        clientId,
        title,
        description: description || null,
        startDate: startDate || null,
        endDate: endDate || null,
      })
      .returning();

    return Response.json({
      success: true,
      data: {
        id: newProgram.id,
        title: newProgram.title,
        description: newProgram.description,
        status: newProgram.status,
        startDate: newProgram.startDate,
        endDate: newProgram.endDate,
        createdAt: newProgram.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating program:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create program' } },
      { status: 500 }
    );
  }
}
