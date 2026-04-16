import { db } from '@/db';
import { coachProfiles, forms, formResponses } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type { Form, SessionType } from '@/db/schema';

/**
 * P0-09 — Intake form resolution helpers (server-only).
 */

/**
 * Resolve the intake form applicable to a (coach, sessionTypeId) pair.
 *
 * Priority:
 *   1. session_types[id].intakeFormId   (per-session override)
 *   2. coach_profiles.defaultIntakeFormId (coach default)
 *   3. null (no intake required)
 *
 * Returns the full published form, or null if nothing applies or the
 * referenced form is unpublished / missing.
 */
export async function resolveIntakeFormForSession(
  coachId: string,
  sessionTypeId: string | null | undefined
): Promise<Form | null> {
  const coach = await db
    .select({
      sessionTypes: coachProfiles.sessionTypes,
      defaultIntakeFormId: coachProfiles.defaultIntakeFormId,
    })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, coachId))
    .limit(1);

  if (coach.length === 0) return null;

  const { sessionTypes, defaultIntakeFormId } = coach[0];

  let formId: number | null = null;

  if (sessionTypeId) {
    const match = (sessionTypes as SessionType[] | null)?.find((st) => st.id === sessionTypeId);
    if (match?.intakeFormId != null) {
      formId = match.intakeFormId;
    }
  }

  if (formId == null && defaultIntakeFormId != null) {
    formId = defaultIntakeFormId;
  }

  if (formId == null) return null;

  const rows = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.isPublished, true)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Check whether a booking already has a linked intake response.
 * Returns the response id if so, null otherwise.
 */
export async function findIntakeResponseForBooking(
  bookingId: number,
  respondentId: string
): Promise<number | null> {
  const rows = await db
    .select({ id: formResponses.id })
    .from(formResponses)
    .where(
      and(eq(formResponses.bookingId, bookingId), eq(formResponses.respondentId, respondentId))
    )
    .limit(1);
  return rows[0]?.id ?? null;
}
