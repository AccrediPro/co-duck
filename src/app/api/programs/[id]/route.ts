import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { programs, users, goals, attachments } from '@/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
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

    // Get coach and client info
    const [coach, client] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, program.coachId) }),
      db.query.users.findFirst({ where: eq(users.id, program.clientId) }),
    ]);

    // Get goals stats
    const goalsStats = await db
      .select({
        total: sql<number>`count(*)`.as('total'),
        completed: sql<number>`count(*) filter (where ${goals.status} = 'completed')`.as(
          'completed'
        ),
      })
      .from(goals)
      .where(eq(goals.programId, programId));

    // Get attachment count
    const attachmentCount = await db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(attachments)
      .where(eq(attachments.programId, programId));

    return Response.json({
      success: true,
      data: {
        id: program.id,
        title: program.title,
        description: program.description,
        status: program.status,
        startDate: program.startDate,
        endDate: program.endDate,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
        coach: coach ? { id: coach.id, name: coach.name, avatarUrl: coach.avatarUrl } : null,
        client: client ? { id: client.id, name: client.name, avatarUrl: client.avatarUrl } : null,
        goalsCount: Number(goalsStats[0]?.total ?? 0),
        goalsCompleted: Number(goalsStats[0]?.completed ?? 0),
        attachmentCount: Number(attachmentCount[0]?.count ?? 0),
        isCoach: program.coachId === userId,
      },
    });
  } catch (error) {
    console.error('Error fetching program:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch program' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'programs-patch');
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
    const body = await request.json();

    if (isNaN(programId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid program ID' } },
        { status: 400 }
      );
    }

    const program = await db.query.programs.findFirst({
      where: eq(programs.id, programId),
    });

    if (!program) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Program not found' } },
        { status: 404 }
      );
    }

    // Only coach can update
    if (program.coachId !== userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the coach can update programs' },
        },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) {
      const validStatuses = ['active', 'completed', 'archived'];
      if (!validStatuses.includes(body.status)) {
        return Response.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: 'Status must be active, completed, or archived',
            },
          },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }
    if (body.startDate !== undefined) {
      if (body.startDate !== null && !dateRegex.test(body.startDate)) {
        return Response.json(
          {
            success: false,
            error: { code: 'INVALID_DATE', message: 'startDate must be in YYYY-MM-DD format' },
          },
          { status: 400 }
        );
      }
      updateData.startDate = body.startDate;
    }
    if (body.endDate !== undefined) {
      if (body.endDate !== null && !dateRegex.test(body.endDate)) {
        return Response.json(
          {
            success: false,
            error: { code: 'INVALID_DATE', message: 'endDate must be in YYYY-MM-DD format' },
          },
          { status: 400 }
        );
      }
      updateData.endDate = body.endDate;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { success: false, error: { code: 'NO_UPDATES', message: 'No valid updates provided' } },
        { status: 400 }
      );
    }

    const [updatedProgram] = await db
      .update(programs)
      .set(updateData)
      .where(eq(programs.id, programId))
      .returning();

    return Response.json({
      success: true,
      data: {
        id: updatedProgram.id,
        title: updatedProgram.title,
        description: updatedProgram.description,
        status: updatedProgram.status,
        startDate: updatedProgram.startDate,
        endDate: updatedProgram.endDate,
        updatedAt: updatedProgram.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating program:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update program' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'programs-delete');
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
          error: { code: 'FORBIDDEN', message: 'Only the coach can delete programs' },
        },
        { status: 403 }
      );
    }

    await db.delete(programs).where(eq(programs.id, programId));

    return Response.json({
      success: true,
      data: { message: 'Program deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting program:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete program' } },
      { status: 500 }
    );
  }
}
