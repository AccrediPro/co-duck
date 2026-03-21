import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { sessionNoteTemplates, users } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/session-note-templates
 *
 * List all session note templates available to the authenticated coach:
 * system templates (isSystem=true) + the coach's own custom templates.
 *
 * @returns {Object} Array of templates
 */
export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'session-note-templates-list');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can access session note templates' } },
        { status: 403 }
      );
    }

    const templates = await db
      .select()
      .from(sessionNoteTemplates)
      .where(or(eq(sessionNoteTemplates.isSystem, true), eq(sessionNoteTemplates.coachId, userId)));

    return Response.json({ success: true, data: { templates } });
  } catch (error) {
    console.error('Error fetching session note templates:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch templates' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/session-note-templates
 *
 * Create a custom session note template for the authenticated coach.
 *
 * @body {string} name - Template name (required)
 * @body {string} [description] - Optional description
 * @body {Array} sections - Array of section objects (required, min 1)
 *
 * @returns {Object} Created template
 */
export async function POST(request: Request) {
  const rl = rateLimit(request, WRITE_LIMIT, 'session-note-templates-create');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only coaches can create session note templates' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;
    const sections = Array.isArray(body?.sections) ? body.sections : null;

    if (!name) {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'name is required' } },
        { status: 400 }
      );
    }

    if (!sections || sections.length === 0) {
      return Response.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'sections is required and must have at least one item' } },
        { status: 400 }
      );
    }

    const [template] = await db
      .insert(sessionNoteTemplates)
      .values({ coachId: userId, name, description, sections, isSystem: false })
      .returning();

    return Response.json({ success: true, data: { template } }, { status: 201 });
  } catch (error) {
    console.error('Error creating session note template:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create template' } },
      { status: 500 }
    );
  }
}
