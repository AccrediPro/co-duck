/**
 * @fileoverview Coach Profile AI Draft Generator (P0-11)
 *
 * Takes free-form text about a coach (scraped website copy, pasted "About"
 * section, Instagram bio) and returns a strongly-typed draft of a AccrediPro CoachHub
 * coach profile for the coach to review and edit.
 *
 * Uses GPT-4o-mini in JSON mode. Output is validated with Zod before it's
 * ever returned to the API handler, so downstream consumers can trust the
 * shape.
 *
 * @module lib/ai/coach-draft
 */

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

import { getOpenAI } from './openai';
import { SESSION_DURATIONS } from '@/lib/validators/coach-onboarding';

/* ==========================================================================
   Zod schema — exact shape the model must return
   ========================================================================== */

/** Credential types accepted by the coach profile (mirrors CREDENTIAL_TYPES). */
const draftCredentialTypes = ['certification', 'degree', 'license', 'membership'] as const;

const draftCredentialSchema = z.object({
  type: z.enum(draftCredentialTypes),
  title: z.string().min(1).max(200),
  issuer: z.string().min(1).max(200),
  issuedYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable(),
  credentialId: z.string().max(100).nullable().optional(),
  verificationUrl: z
    .string()
    .url()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});

const draftSpecialtySchema = z.object({
  category: z.string().min(1),
  subNiches: z.array(z.string()).default([]),
});

const draftSessionTypeSchema = z.object({
  name: z.string().min(1).max(100),
  duration: z.number().refine((v) => (SESSION_DURATIONS as readonly number[]).includes(v), {
    message: 'duration must be one of 15|30|45|60|90|120',
  }),
  priceCents: z.number().int().min(0),
});

export const coachDraftSchema = z.object({
  headline: z.string().min(10).max(150),
  bio: z.string().min(50).max(2000),
  specialties: z.array(draftSpecialtySchema).min(1).max(3),
  credentials: z.array(draftCredentialSchema).max(20).default([]),
  sessionTypes: z.array(draftSessionTypeSchema).min(1).max(6),
  hourlyRateCents: z.number().int().min(0).nullable().default(null),
  slugSuggestion: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric + hyphens'),
});

export type CoachDraft = z.infer<typeof coachDraftSchema>;

/* ==========================================================================
   Prompt loading — read once, cache in-process
   ========================================================================== */

let cachedSystemPrompt: string | null = null;

async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const promptPath = path.join(process.cwd(), 'src/lib/ai/prompts/coach-draft.md');
  cachedSystemPrompt = await fs.readFile(promptPath, 'utf-8');
  return cachedSystemPrompt;
}

/* ==========================================================================
   Errors
   ========================================================================== */

export class DraftGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftGenerationError';
  }
}

/* ==========================================================================
   Public API
   ========================================================================== */

export interface GenerateCoachDraftInput {
  /** Scraped or pasted raw text describing the coach. */
  sourceText: string;
  /** Optional coach display name for slug priming + fallback. */
  coachName?: string;
  /** Optional source URL — included in the prompt for disambiguation. */
  sourceUrl?: string;
}

/**
 * Generates a structured coach profile draft from unstructured text.
 *
 * Contract:
 * - Calls OpenAI `gpt-4o-mini` with `response_format: { type: 'json_object' }`.
 * - Parses + validates the response with {@link coachDraftSchema}.
 * - On any malformed output, throws {@link DraftGenerationError}.
 *
 * @throws {DraftGenerationError} When the model fails or returns invalid JSON.
 */
export async function generateCoachDraft(input: GenerateCoachDraftInput): Promise<CoachDraft> {
  const sourceText = (input.sourceText || '').trim();
  if (sourceText.length < 40) {
    throw new DraftGenerationError(
      'Source text is too short — paste at least a short bio (about 40+ characters).'
    );
  }

  const systemPrompt = await loadSystemPrompt();
  const openai = getOpenAI();

  const userPayload = [
    input.coachName ? `Coach display name: ${input.coachName}` : null,
    input.sourceUrl ? `Source URL: ${input.sourceUrl}` : null,
    '---',
    'Source text:',
    sourceText,
  ]
    .filter(Boolean)
    .join('\n');

  let response;
  try {
    response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPayload },
      ],
    });
  } catch (err) {
    throw new DraftGenerationError(`AI draft request failed: ${(err as Error).message}`);
  }

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new DraftGenerationError('AI returned an empty response.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DraftGenerationError('AI returned non-JSON output.');
  }

  const result = coachDraftSchema.safeParse(parsed);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new DraftGenerationError(
      `AI draft failed validation: ${firstIssue?.path.join('.') || 'root'} — ${firstIssue?.message || 'unknown error'}`
    );
  }

  return result.data;
}
