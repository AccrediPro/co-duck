import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { forms } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/forms/[id]/publish
 *
 * Publishes or unpublishes a form (coach only).
 *
 * @body {{ publish: boolean }}
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, WRITE_LIMIT, 'forms-publish');
  if (!rl.success) return rateLimitResponse(rl);

  const { id } = await params;
  const formId = parseInt(id, 10);
  if (isNaN(formId)) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found' } },
      { status: 404 }
    );
  }

  const rows = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.coachId, userId)))
    .limit(1);

  const form = rows[0];
  if (!form) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found' } },
      { status: 404 }
    );
  }

  let body: { publish?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // default to toggling
  }

  const shouldPublish = typeof body.publish === 'boolean' ? body.publish : !form.isPublished;

  // Require at least one question before publishing
  if (shouldPublish && form.questions.length === 0) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Add at least one question before publishing',
        },
      },
      { status: 422 }
    );
  }

  const [updated] = await db
    .update(forms)
    .set({
      isPublished: shouldPublish,
      publishedAt: shouldPublish ? (form.publishedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(forms.id, form.id))
    .returning();

  return Response.json({ success: true, data: updated });
}
