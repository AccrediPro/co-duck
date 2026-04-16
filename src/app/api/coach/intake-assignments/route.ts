import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { coachProfiles, forms, users } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { assignIntakeFormSchema } from '@/lib/validators/intake-forms';
import type { SessionType } from '@/db/schema';

/**
 * GET /api/coach/intake-assignments
 *
 * Returns the coach's default intake form id, per-session-type assignments, and
 * the list of published forms the coach can pick from.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const userRows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRows[0]?.role !== 'coach') {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Coach-only endpoint' } },
      { status: 403 }
    );
  }

  const profileRows = await db
    .select({
      defaultIntakeFormId: coachProfiles.defaultIntakeFormId,
      sessionTypes: coachProfiles.sessionTypes,
    })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  if (profileRows.length === 0) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Coach profile not found' } },
      { status: 404 }
    );
  }

  const published = await db
    .select({
      id: forms.id,
      title: forms.title,
      formType: forms.formType,
    })
    .from(forms)
    .where(and(eq(forms.coachId, userId), eq(forms.isPublished, true)));

  return Response.json({
    success: true,
    data: {
      defaultFormId: profileRows[0].defaultIntakeFormId,
      sessionTypes: (profileRows[0].sessionTypes as SessionType[] | null) ?? [],
      availableForms: published,
    },
  });
}

/**
 * PATCH /api/coach/intake-assignments
 *
 * Updates the coach's default intake form + per-session-type overrides.
 */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const rl = rateLimit(request, WRITE_LIMIT, 'intake-assignments-update');
  if (!rl.success) return rateLimitResponse(rl);

  const userRows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRows[0]?.role !== 'coach') {
    return Response.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Coach-only endpoint' } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = assignIntakeFormSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
      },
      { status: 422 }
    );
  }

  const { defaultFormId, perSessionType } = parsed.data;

  const profileRows = await db
    .select({ sessionTypes: coachProfiles.sessionTypes })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  if (profileRows.length === 0) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Coach profile not found' } },
      { status: 404 }
    );
  }

  // Validate every referenced form ID belongs to this coach and is published.
  const referencedIds = new Set<number>();
  if (defaultFormId != null) referencedIds.add(defaultFormId);
  for (const id of Object.values(perSessionType)) {
    if (id != null) referencedIds.add(id);
  }

  if (referencedIds.size > 0) {
    const matches = await db
      .select({ id: forms.id, isPublished: forms.isPublished })
      .from(forms)
      .where(and(eq(forms.coachId, userId), inArray(forms.id, Array.from(referencedIds))));
    const matchMap = new Map(matches.map((m) => [m.id, m.isPublished]));
    for (const id of Array.from(referencedIds)) {
      const published = matchMap.get(id);
      if (published === undefined) {
        return Response.json(
          {
            success: false,
            error: {
              code: 'INVALID_FORM',
              message: `Form ${id} does not belong to you`,
            },
          },
          { status: 400 }
        );
      }
      if (!published) {
        return Response.json(
          {
            success: false,
            error: {
              code: 'INVALID_FORM',
              message: `Form ${id} must be published before it can be assigned`,
            },
          },
          { status: 400 }
        );
      }
    }
  }

  // Merge per-session-type updates into the existing sessionTypes array.
  const currentSessionTypes = (profileRows[0].sessionTypes as SessionType[] | null) ?? [];
  const updatedSessionTypes = currentSessionTypes.map((st) => {
    if (Object.prototype.hasOwnProperty.call(perSessionType, st.id)) {
      return { ...st, intakeFormId: perSessionType[st.id] };
    }
    return st;
  });

  await db
    .update(coachProfiles)
    .set({
      defaultIntakeFormId: defaultFormId ?? null,
      sessionTypes: updatedSessionTypes,
    })
    .where(eq(coachProfiles.userId, userId));

  return Response.json({
    success: true,
    data: {
      defaultFormId: defaultFormId ?? null,
      sessionTypes: updatedSessionTypes,
    },
  });
}
