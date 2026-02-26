import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { programs, goals } from '@/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'goals-list');
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
    const programId = parseInt(id);

    if (isNaN(programId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid program ID' } },
        { status: 400 }
      );
    }

    const program = await db.query.programs.findFirst({
      where: and(
        eq(programs.id, programId),
        or(eq(programs.coachId, userId), eq(programs.clientId, userId))
      ),
    });

    if (!program) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Program not found' } },
        { status: 404 }
      );
    }

    const programGoals = await db
      .select()
      .from(goals)
      .where(eq(goals.programId, programId))
      .orderBy(desc(goals.createdAt));

    return Response.json({
      success: true,
      data: {
        goals: programGoals.map((g) => ({
          id: g.id,
          programId: g.programId,
          title: g.title,
          description: g.description,
          status: g.status,
          priority: g.priority,
          dueDate: g.dueDate,
          completedAt: g.completedAt,
          createdAt: g.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch goals' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'goals-create');
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
    const programId = parseInt(id);

    if (isNaN(programId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid program ID' } },
        { status: 400 }
      );
    }

    // Get program and verify coach access
    const program = await db.query.programs.findFirst({
      where: eq(programs.id, programId),
    });

    if (!program) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Program not found' } },
        { status: 404 }
      );
    }

    if (program.coachId !== userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the coach can create goals' },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, priority, dueDate } = body;

    if (!title) {
      return Response.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'title is required' },
        },
        { status: 400 }
      );
    }

    // Validate priority if provided
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_PRIORITY', message: 'Priority must be low, medium, or high' },
        },
        { status: 400 }
      );
    }

    // Validate due date if provided
    if (dueDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dueDate)) {
        return Response.json(
          {
            success: false,
            error: { code: 'INVALID_DATE', message: 'dueDate must be in YYYY-MM-DD format' },
          },
          { status: 400 }
        );
      }
    }

    const [newGoal] = await db
      .insert(goals)
      .values({
        programId,
        coachId: program.coachId,
        clientId: program.clientId,
        title,
        description: description || null,
        priority: priority || 'medium',
        dueDate: dueDate || null,
      })
      .returning();

    return Response.json({
      success: true,
      data: {
        id: newGoal.id,
        programId: newGoal.programId,
        title: newGoal.title,
        description: newGoal.description,
        status: newGoal.status,
        priority: newGoal.priority,
        dueDate: newGoal.dueDate,
        createdAt: newGoal.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating goal:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create goal' } },
      { status: 500 }
    );
  }
}
