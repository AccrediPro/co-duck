import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { forms, users } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { createFormSchema, listFormsQuerySchema } from '@/lib/validators/forms';

/**
 * GET /api/forms
 *
 * Returns forms created by the authenticated coach.
 *
 * @query {string} [formType] - Filter by form type
 * @query {string} [isPublished] - Filter by published state ("true" | "false")
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, FREQUENT_LIMIT, 'forms-list');
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listFormsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return Response.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'Invalid query parameters' } },
        { status: 400 }
      );
    }

    const { formType, isPublished, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [eq(forms.coachId, userId)];
    if (formType) conditions.push(eq(forms.formType, formType));
    if (isPublished !== undefined) conditions.push(eq(forms.isPublished, isPublished));

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(forms)
        .where(and(...conditions))
        .orderBy(desc(forms.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(forms)
        .where(and(...conditions)),
    ]);

    const total = countResult[0]?.count ?? 0;

    return Response.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[GET /api/forms]', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch forms' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms
 *
 * Creates a new form (coach only).
 *
 * @body {CreateFormData}
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, WRITE_LIMIT, 'forms-create');
  if (!rl.success) return rateLimitResponse(rl);

  try {
    // Verify the user is a coach
    const userRecord = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord[0] || userRecord[0].role !== 'coach') {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can create forms' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createFormSchema.safeParse(body);
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

    const { title, description, formType, questions } = parsed.data;

    const [created] = await db
      .insert(forms)
      .values({
        coachId: userId,
        title,
        description: description ?? null,
        formType,
        questions,
        isPublished: false,
      })
      .returning();

    return Response.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/forms]', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create form' } },
      { status: 500 }
    );
  }
}
