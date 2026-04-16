import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { forms } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { updateFormSchema } from '@/lib/validators/forms';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveForm(id: string, coachId: string) {
  const formId = parseInt(id, 10);
  if (isNaN(formId)) return null;
  const rows = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.coachId, coachId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * GET /api/forms/[id]
 *
 * Returns a single form owned by the authenticated coach.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, FREQUENT_LIMIT, 'forms-get');
  if (!rl.success) return rateLimitResponse(rl);

  const { id } = await params;
  const form = await resolveForm(id, userId);
  if (!form) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found' } },
      { status: 404 }
    );
  }

  return Response.json({ success: true, data: form });
}

/**
 * PATCH /api/forms/[id]
 *
 * Updates a form (coach only, must be unpublished to edit questions).
 *
 * @body {UpdateFormData}
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, WRITE_LIMIT, 'forms-update');
  if (!rl.success) return rateLimitResponse(rl);

  const { id } = await params;
  const form = await resolveForm(id, userId);
  if (!form) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found' } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = updateFormSchema.safeParse(body);
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

  const updates = parsed.data;

  // Prevent editing questions on a published form that has responses
  if (updates.questions && form.isPublished) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Unpublish the form before editing its questions',
        },
      },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(forms)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(forms.id, form.id))
    .returning();

  return Response.json({ success: true, data: updated });
}

/**
 * DELETE /api/forms/[id]
 *
 * Deletes a form (coach only). Cascades to form_responses.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, WRITE_LIMIT, 'forms-delete');
  if (!rl.success) return rateLimitResponse(rl);

  const { id } = await params;
  const form = await resolveForm(id, userId);
  if (!form) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found' } },
      { status: 404 }
    );
  }

  await db.delete(forms).where(eq(forms.id, form.id));

  return Response.json({ success: true, data: { id: form.id } });
}
