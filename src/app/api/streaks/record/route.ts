import { auth } from '@clerk/nextjs/server';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { recordStreakActivity } from '@/lib/streaks';

const VALID_ACTION_TYPES = [
  'session_completed',
  'action_item_completed',
  'iconnect_post',
  'message_sent',
  'check_in_completed',
  'session_prep_completed',
] as const;

type ActionType = typeof VALID_ACTION_TYPES[number];

/**
 * POST /api/streaks/record
 *
 * Records a streak activity. Protected by auth or CRON_SECRET.
 * Mainly for testing/admin — real recording happens via integration hooks.
 */
export async function POST(request: Request) {
  // Check CRON_SECRET first for internal calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader && (
    authHeader === cronSecret || authHeader === `Bearer ${cronSecret}`
  );

  if (!isCron) {
    const rl = rateLimit(request, WRITE_LIMIT, 'streaks-record');
    if (!rl.success) return rateLimitResponse(rl);

    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
  }

  try {
    const body = await request.json();
    const { userId, actionType, referenceId } = body;

    if (!userId || typeof userId !== 'string') {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'userId is required' } },
        { status: 400 }
      );
    }

    if (!actionType || !VALID_ACTION_TYPES.includes(actionType as ActionType)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ACTION', message: `actionType must be one of: ${VALID_ACTION_TYPES.join(', ')}` } },
        { status: 400 }
      );
    }

    await recordStreakActivity(
      userId,
      actionType as ActionType,
      referenceId ? String(referenceId) : undefined
    );

    return Response.json({ success: true, data: { recorded: true } });
  } catch (error) {
    console.error('Error recording streak activity:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record activity' } },
      { status: 500 }
    );
  }
}
