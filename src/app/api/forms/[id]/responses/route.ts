import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { forms, formResponses } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { submitFormResponseSchema } from '@/lib/validators/forms';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/forms/[id]/responses
 *
 * Returns all responses to a form (coach only).
 *
 * @query {number} [page=1]
 * @query {number} [limit=20]
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, FREQUENT_LIMIT, 'form-responses-list');
  if (!rl.success) return rateLimitResponse(rl);

  const { id } = await params;
  const formId = parseInt(id, 10);
  if (isNaN(formId)) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found' } },
      { status: 404 }
    );
  }

  // Verify form ownership
  const formRows = await db
    .select({ id: forms.id })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.coachId, userId)))
    .limit(1);

  if (!formRows[0]) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found' } },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(formResponses)
      .where(eq(formResponses.formId, formId))
      .orderBy(desc(formResponses.submittedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(formResponses)
      .where(eq(formResponses.formId, formId)),
  ]);

  const total = countResult[0]?.count ?? 0;

  return Response.json({
    success: true,
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/**
 * POST /api/forms/[id]/responses
 *
 * Submits a response to a published form (any authenticated user).
 *
 * @body {SubmitFormResponseData}
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, WRITE_LIMIT, 'form-responses-submit');
  if (!rl.success) return rateLimitResponse(rl);

  const { id } = await params;
  const formId = parseInt(id, 10);
  if (isNaN(formId)) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found' } },
      { status: 404 }
    );
  }

  // Verify form is published
  const formRows = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.isPublished, true)))
    .limit(1);

  const form = formRows[0];
  if (!form) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found or not published' } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = submitFormResponseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Invalid input',
        },
      },
      { status: 422 }
    );
  }

  const { answers, bookingId } = parsed.data;

  // Validate required questions are answered
  const requiredQuestions = form.questions.filter((q) => q.required);
  const missingRequired = requiredQuestions.filter((q) => {
    const answer = answers[q.id];
    return answer === undefined || answer === null || answer === '';
  });

  if (missingRequired.length > 0) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Required questions not answered: ${missingRequired.map((q) => q.label).join(', ')}`,
        },
      },
      { status: 422 }
    );
  }

  const [created] = await db
    .insert(formResponses)
    .values({
      formId,
      respondentId: userId,
      bookingId: bookingId ?? null,
      answers,
    })
    .returning();

  return Response.json({ success: true, data: created }, { status: 201 });
}
