import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { attachments, programs, goals, actionItems } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { rateLimit, DEFAULT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

async function verifyParticipantForQuery(
  userId: string,
  programId: number | null,
  goalId: number | null,
  actionItemId: number | null
): Promise<boolean> {
  if (programId) {
    const [program] = await db
      .select({ coachId: programs.coachId, clientId: programs.clientId })
      .from(programs)
      .where(eq(programs.id, programId))
      .limit(1);
    if (!program) return false;
    return program.coachId === userId || program.clientId === userId;
  }

  if (goalId) {
    const [goal] = await db
      .select({ coachId: goals.coachId, clientId: goals.clientId })
      .from(goals)
      .where(eq(goals.id, goalId))
      .limit(1);
    if (!goal) return false;
    return goal.coachId === userId || goal.clientId === userId;
  }

  if (actionItemId) {
    const [item] = await db
      .select({ coachId: actionItems.coachId, clientId: actionItems.clientId })
      .from(actionItems)
      .where(eq(actionItems.id, actionItemId))
      .limit(1);
    if (!item) return false;
    return item.coachId === userId || item.clientId === userId;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, DEFAULT_LIMIT, 'attachments-list');
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const programIdStr = searchParams.get('programId');
    const goalIdStr = searchParams.get('goalId');
    const actionItemIdStr = searchParams.get('actionItemId');

    const programId = programIdStr ? parseInt(programIdStr, 10) : null;
    const goalId = goalIdStr ? parseInt(goalIdStr, 10) : null;
    const actionItemId = actionItemIdStr ? parseInt(actionItemIdStr, 10) : null;

    if (
      (programId !== null && isNaN(programId)) ||
      (goalId !== null && isNaN(goalId)) ||
      (actionItemId !== null && isNaN(actionItemId))
    ) {
      return Response.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'Invalid ID parameter' } },
        { status: 400 }
      );
    }

    if (!programId && !goalId && !actionItemId) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'MISSING_FILTER',
            message: 'At least one of programId, goalId, or actionItemId is required',
          },
        },
        { status: 400 }
      );
    }

    // Verify user is a participant
    const isParticipant = await verifyParticipantForQuery(userId, programId, goalId, actionItemId);
    if (!isParticipant) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Build filter condition
    const conditions = [];
    if (programId) conditions.push(eq(attachments.programId, programId));
    if (goalId) conditions.push(eq(attachments.goalId, goalId));
    if (actionItemId) conditions.push(eq(attachments.actionItemId, actionItemId));

    const results = await db
      .select()
      .from(attachments)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(attachments.createdAt));

    return Response.json({ success: true, data: results });
  } catch (error) {
    console.error('List attachments error:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } },
      { status: 500 }
    );
  }
}
