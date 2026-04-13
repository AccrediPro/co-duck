import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sessionNoteTemplates, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/session-note-templates/:id
 *
 * Update a custom session note template owned by the authenticated coach.
 * System templates cannot be modified.
 *
 * @body {string} [name] - New template name
 * @body {string} [description] - New description
 * @body {Array} [sections] - New sections array
 *
 * @returns {Object} Updated template
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'session-note-templates-update');
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
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid template ID' } },
        { status: 400 }
      );
    }

    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can update session note templates' },
        },
        { status: 403 }
      );
    }

    // Verify the template exists, belongs to this coach, and is not a system template
    const existing = await db.query.sessionNoteTemplates.findFirst({
      where: eq(sessionNoteTemplates.id, templateId),
      columns: { id: true, coachId: true, isSystem: true },
    });

    if (!existing) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } },
        { status: 404 }
      );
    }

    if (existing.isSystem || existing.coachId !== userId) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify this template' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body?.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body?.description === 'string') {
      updates.description = body.description.trim() || null;
    }
    if (Array.isArray(body?.sections) && body.sections.length > 0) {
      updates.sections = body.sections;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'No valid fields to update' } },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(sessionNoteTemplates)
      .set(updates)
      .where(and(eq(sessionNoteTemplates.id, templateId), eq(sessionNoteTemplates.coachId, userId)))
      .returning();

    return Response.json({ success: true, data: { template: updated } });
  } catch (error) {
    console.error('Error updating session note template:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update template' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/session-note-templates/:id
 *
 * Delete a custom session note template owned by the authenticated coach.
 * System templates cannot be deleted.
 *
 * @returns {Object} Success confirmation
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'session-note-templates-delete');
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
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid template ID' } },
        { status: 400 }
      );
    }

    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can delete session note templates' },
        },
        { status: 403 }
      );
    }

    // Verify the template exists, belongs to this coach, and is not a system template
    const existing = await db.query.sessionNoteTemplates.findFirst({
      where: eq(sessionNoteTemplates.id, templateId),
      columns: { id: true, coachId: true, isSystem: true },
    });

    if (!existing) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } },
        { status: 404 }
      );
    }

    if (existing.isSystem || existing.coachId !== userId) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete this template' } },
        { status: 403 }
      );
    }

    await db
      .delete(sessionNoteTemplates)
      .where(
        and(eq(sessionNoteTemplates.id, templateId), eq(sessionNoteTemplates.coachId, userId))
      );

    return Response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting session note template:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete template' } },
      { status: 500 }
    );
  }
}
