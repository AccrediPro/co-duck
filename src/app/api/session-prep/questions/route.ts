import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sessionPrepQuestions, coachProfiles } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/session-prep/questions
 *
 * Returns this coach's configured prep questions.
 * Falls back to default questions if coach hasn't customized.
 * Coach auth required.
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'session-prep-questions-get');
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
    const coachProfile = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, userId),
      columns: { userId: true },
    });

    if (!coachProfile) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can access this endpoint' } },
        { status: 403 }
      );
    }

    // Try coach's custom questions first
    const customQuestions = await db
      .select({ questions: sessionPrepQuestions.questions })
      .from(sessionPrepQuestions)
      .where(eq(sessionPrepQuestions.coachId, userId))
      .limit(1);

    if (customQuestions.length > 0) {
      return Response.json({
        success: true,
        data: { questions: customQuestions[0].questions, isCustom: true },
      });
    }

    // Fall back to defaults
    const defaultQuestions = await db
      .select({ questions: sessionPrepQuestions.questions })
      .from(sessionPrepQuestions)
      .where(
        and(
          isNull(sessionPrepQuestions.coachId),
          eq(sessionPrepQuestions.isDefault, true)
        )
      )
      .limit(1);

    return Response.json({
      success: true,
      data: {
        questions: defaultQuestions.length > 0 ? defaultQuestions[0].questions : [],
        isCustom: false,
      },
    });
  } catch (error) {
    console.error('[SessionPrep] Error fetching questions:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch questions' } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/session-prep/questions
 *
 * Upserts coach's custom prep questions. Min 2, max 5 questions.
 * Coach auth required.
 */
export async function PUT(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'session-prep-questions-put');
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
    const coachProfile = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, userId),
      columns: { userId: true },
    });

    if (!coachProfile) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can access this endpoint' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions)) {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'questions array is required' } },
        { status: 400 }
      );
    }

    // Validate: min 2, max 5, all non-empty strings
    const cleaned = questions
      .filter((q: unknown) => typeof q === 'string' && q.trim().length > 0)
      .map((q: string) => q.trim());

    if (cleaned.length < 2 || cleaned.length > 5) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Must have between 2 and 5 questions' } },
        { status: 400 }
      );
    }

    // Upsert: check if coach already has custom questions
    const existing = await db
      .select({ id: sessionPrepQuestions.id })
      .from(sessionPrepQuestions)
      .where(eq(sessionPrepQuestions.coachId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(sessionPrepQuestions)
        .set({ questions: cleaned })
        .where(eq(sessionPrepQuestions.coachId, userId));
    } else {
      await db.insert(sessionPrepQuestions).values({
        coachId: userId,
        questions: cleaned,
        isDefault: false,
      });
    }

    return Response.json({
      success: true,
      data: { questions: cleaned },
    });
  } catch (error) {
    console.error('[SessionPrep] Error saving questions:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save questions' } },
      { status: 500 }
    );
  }
}
