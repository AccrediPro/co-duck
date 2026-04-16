import { z } from 'zod';

// ============================================================================
// FORM TYPE
// ============================================================================

export const FORM_TYPES = ['intake', 'session_feedback', 'progress_check', 'custom'] as const;
export type FormType = (typeof FORM_TYPES)[number];

// ============================================================================
// QUESTION TYPES
// ============================================================================

export const QUESTION_TYPES = [
  'short_text',
  'long_text',
  'single_choice',
  'multi_choice',
  'rating',
  'yes_no',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// ============================================================================
// QUESTION SCHEMA
// ============================================================================

export const formQuestionSchema = z
  .object({
    id: z.string().uuid(),
    order: z.number().int().min(0),
    type: z.enum(QUESTION_TYPES),
    label: z.string().min(1, 'Question label is required').max(500),
    required: z.boolean().default(false),
    options: z.array(z.string().min(1).max(200)).max(20).optional(),
  })
  .refine(
    (q) => {
      // options required for choice questions
      if (q.type === 'single_choice' || q.type === 'multi_choice') {
        return Array.isArray(q.options) && q.options.length >= 2;
      }
      return true;
    },
    { message: 'Choice questions require at least 2 options', path: ['options'] }
  );

export type FormQuestionData = z.infer<typeof formQuestionSchema>;

// ============================================================================
// FORM CRUD SCHEMAS
// ============================================================================

export const createFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional().nullable(),
  formType: z.enum(FORM_TYPES).default('custom'),
  questions: z.array(formQuestionSchema).max(50).default([]),
});

export type CreateFormData = z.infer<typeof createFormSchema>;

export const updateFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  formType: z.enum(FORM_TYPES).optional(),
  questions: z.array(formQuestionSchema).max(50).optional(),
});

export type UpdateFormData = z.infer<typeof updateFormSchema>;

// ============================================================================
// FORM RESPONSE SCHEMA
// ============================================================================

export const submitFormResponseSchema = z.object({
  answers: z.record(
    z.string().uuid(), // question id
    z.union([z.string(), z.array(z.string()), z.number(), z.boolean()])
  ),
  bookingId: z.number().int().positive().optional().nullable(),
});

export type SubmitFormResponseData = z.infer<typeof submitFormResponseSchema>;

// ============================================================================
// QUERY PARAMS
// ============================================================================

export const listFormsQuerySchema = z.object({
  formType: z.enum(FORM_TYPES).optional(),
  isPublished: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v || '20', 10)))),
});

export type ListFormsQuery = z.infer<typeof listFormsQuerySchema>;
