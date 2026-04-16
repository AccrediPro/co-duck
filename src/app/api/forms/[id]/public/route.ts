import { db } from '@/db';
import { forms } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/forms/[id]/public
 *
 * Returns a published form's questions for public consumption (no auth required).
 * Strips internal fields — returns only what a respondent needs to fill the form.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const formId = parseInt(id, 10);
  if (isNaN(formId)) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found' } },
      { status: 404 }
    );
  }

  const rows = await db
    .select({
      id: forms.id,
      title: forms.title,
      description: forms.description,
      formType: forms.formType,
      questions: forms.questions,
    })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.isPublished, true)))
    .limit(1);

  const form = rows[0];
  if (!form) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Form not found' } },
      { status: 404 }
    );
  }

  return Response.json({ success: true, data: form });
}
