import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { goals, users, attachments, actionItems } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'goals-get');
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
    const goalId = parseInt(id);

    if (isNaN(goalId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid goal ID' } },
        { status: 400 }
      );
    }

    const goal = await db.query.goals.findFirst({
      where: and(
        eq(goals.id, goalId),
        or(eq(goals.coachId, userId), eq(goals.clientId, userId))
      ),
    });

    if (!goal) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } },
        { status: 404 }
      );
    }

    // Get coach and client info
    const [coach, client] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, goal.coachId) }),
      db.query.users.findFirst({ where: eq(users.id, goal.clientId) }),
    ]);

    // Get attachments for this goal
    const goalAttachments = await db
      .select()
      .from(attachments)
      .where(eq(attachments.goalId, goalId));

    // Get linked action items
    const linkedActionItems = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.goalId, goalId));

    return Response.json({
      success: true,
      data: {
        id: goal.id,
        programId: goal.programId,
        title: goal.title,
        description: goal.description,
        status: goal.status,
        priority: goal.priority,
        dueDate: goal.dueDate,
        completedAt: goal.completedAt,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        coach: coach
          ? { id: coach.id, name: coach.name, avatarUrl: coach.avatarUrl }
          : null,
        client: client
          ? { id: client.id, name: client.name, avatarUrl: client.avatarUrl }
          : null,
        attachments: goalAttachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          fileSize: a.fileSize,
          uploadedBy: a.uploadedBy,
          createdAt: a.createdAt,
        })),
        actionItems: linkedActionItems.map((ai) => ({
          id: ai.id,
          title: ai.title,
          description: ai.description,
          dueDate: ai.dueDate,
          isCompleted: ai.isCompleted,
          completedAt: ai.completedAt,
        })),
        isCoach: goal.coachId === userId,
      },
    });
  } catch (error) {
    console.error('Error fetching goal:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch goal' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'goals-patch');
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
    const goalId = parseInt(id);
    const body = await request.json();

    if (isNaN(goalId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid goal ID' } },
        { status: 400 }
      );
    }

    const goal = await db.query.goals.findFirst({
      where: eq(goals.id, goalId),
    });

    if (!goal) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } },
        { status: 404 }
      );
    }

    const isCoach = goal.coachId === userId;
    const isClient = goal.clientId === userId;

    if (!isCoach && !isClient) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Coach can update all fields
    if (isCoach) {
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.priority !== undefined) {
        if (!['low', 'medium', 'high'].includes(body.priority)) {
          return Response.json(
            {
              success: false,
              error: { code: 'INVALID_PRIORITY', message: 'Priority must be low, medium, or high' },
            },
            { status: 400 }
          );
        }
        updateData.priority = body.priority;
      }
      if (body.dueDate !== undefined) {
        if (body.dueDate !== null) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(body.dueDate)) {
            return Response.json(
              {
                success: false,
                error: { code: 'INVALID_DATE', message: 'dueDate must be in YYYY-MM-DD format' },
              },
              { status: 400 }
            );
          }
        }
        updateData.dueDate = body.dueDate;
      }
    }

    // Both coach and client can update status
    if (body.status !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'completed'];
      if (!validStatuses.includes(body.status)) {
        return Response.json(
          {
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Status must be pending, in_progress, or completed' },
          },
          { status: 400 }
        );
      }
      // Client can only set status to completed
      if (isClient && !isCoach && body.status !== 'completed') {
        return Response.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: 'Clients can only mark goals as completed' },
          },
          { status: 403 }
        );
      }
      updateData.status = body.status;
      if (body.status === 'completed') {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { success: false, error: { code: 'NO_UPDATES', message: 'No valid updates provided' } },
        { status: 400 }
      );
    }

    const [updatedGoal] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, goalId))
      .returning();

    return Response.json({
      success: true,
      data: {
        id: updatedGoal.id,
        programId: updatedGoal.programId,
        title: updatedGoal.title,
        description: updatedGoal.description,
        status: updatedGoal.status,
        priority: updatedGoal.priority,
        dueDate: updatedGoal.dueDate,
        completedAt: updatedGoal.completedAt,
        updatedAt: updatedGoal.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating goal:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update goal' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'goals-delete');
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
    const goalId = parseInt(id);

    if (isNaN(goalId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid goal ID' } },
        { status: 400 }
      );
    }

    const goal = await db.query.goals.findFirst({
      where: eq(goals.id, goalId),
    });

    if (!goal) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } },
        { status: 404 }
      );
    }

    if (goal.coachId !== userId) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the coach can delete goals' },
        },
        { status: 403 }
      );
    }

    await db.delete(goals).where(eq(goals.id, goalId));

    return Response.json({
      success: true,
      data: { message: 'Goal deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete goal' } },
      { status: 500 }
    );
  }
}
