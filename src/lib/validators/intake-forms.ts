import { z } from 'zod';

/**
 * P0-09 — Intake Forms validators.
 *
 * Builds on the P0-08 forms primitive. These schemas describe the intake-
 * specific surface: which form is attached to which session type, and the
 * assignment payload used by the form builder UI.
 */

// ============================================================================
// ASSIGNMENT
// ============================================================================

/**
 * Payload sent when a coach assigns an intake form to their profile.
 *
 * - `defaultFormId`: form used by every session type that does not declare
 *   its own override. `null` disables the default.
 * - `perSessionType`: map of sessionType.id → formId (or null to clear).
 *   Overrides the default for that specific session type.
 */
export const assignIntakeFormSchema = z.object({
  defaultFormId: z.number().int().positive().nullable().optional(),
  perSessionType: z
    .record(z.string(), z.number().int().positive().nullable())
    .optional()
    .default({}),
});

export type AssignIntakeFormData = z.infer<typeof assignIntakeFormSchema>;

// ============================================================================
// SUBMIT RESPONSE FOR BOOKING
// ============================================================================

/**
 * Client submits intake answers for a pending booking.
 * The booking must exist and belong to the current user.
 */
export const submitBookingIntakeSchema = z.object({
  answers: z.record(
    z.string(), // question id
    z.union([z.string(), z.array(z.string()), z.number(), z.boolean()])
  ),
});

export type SubmitBookingIntakeData = z.infer<typeof submitBookingIntakeSchema>;
