/**
 * @fileoverview Structured Session Notes Generator (P0-10)
 *
 * Calls GPT-4o with a SOAP-optimized prompt to produce structured coaching
 * session notes from a raw transcript. Returns validated JSON.
 *
 * @module lib/ai/session-notes
 */

import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getOpenAI } from './openai';

/**
 * Default model used for summarization.
 * GPT-4o supports JSON mode and is the most capable general-purpose model
 * for structured clinical-style notes at time of writing.
 */
export const SESSION_NOTES_MODEL = 'gpt-4o';

/**
 * Zod schema describing the structured output from the LLM.
 * We validate every response to guarantee shape before writing to the DB.
 */
export const StructuredNotesSchema = z.object({
  soapSubjective: z.string(),
  soapObjective: z.string(),
  soapAssessment: z.string(),
  soapPlan: z.string(),
  keyTopics: z.array(z.string()),
  actionItemsSuggested: z.array(z.string()),
  nextSessionSuggestions: z.string(),
  followUpEmailSubject: z.string(),
  followUpEmailBody: z.string(),
});

export type StructuredNotes = z.infer<typeof StructuredNotesSchema>;

export interface SessionContext {
  coachName: string;
  clientName: string;
  sessionType: string;
  sessionDate: string;
}

export interface GenerateResult {
  notes: StructuredNotes;
  tokensUsed: number;
  model: string;
}

let cachedPrompt: string | null = null;

/**
 * Load the prompt template from `prompts/session-notes.md` (cached).
 */
async function loadPrompt(): Promise<string> {
  if (cachedPrompt) return cachedPrompt;
  const path = join(process.cwd(), 'src/lib/ai/prompts/session-notes.md');
  cachedPrompt = await readFile(path, 'utf-8');
  return cachedPrompt;
}

/**
 * Substitute `{{placeholders}}` in the prompt template.
 */
function renderPrompt(
  template: string,
  transcript: string,
  ctx: SessionContext
): string {
  return template
    .replace(/\{\{coachName\}\}/g, ctx.coachName)
    .replace(/\{\{clientName\}\}/g, ctx.clientName)
    .replace(/\{\{sessionType\}\}/g, ctx.sessionType)
    .replace(/\{\{sessionDate\}\}/g, ctx.sessionDate)
    .replace(/\{\{transcript\}\}/g, transcript);
}

/**
 * Generate structured SOAP notes from a raw session transcript.
 *
 * @param transcript - Raw transcript text
 * @param ctx - Coach/client/session context for personalization
 * @returns Validated structured notes + token usage
 * @throws {Error} When the LLM returns malformed JSON or fails validation
 */
export async function generateSessionNotes(
  transcript: string,
  ctx: SessionContext
): Promise<GenerateResult> {
  const trimmed = transcript.trim();
  if (!trimmed) {
    throw new Error('Cannot generate notes from an empty transcript.');
  }

  const template = await loadPrompt();
  const userPrompt = renderPrompt(template, trimmed, ctx);

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: SESSION_NOTES_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content:
          'You are a precise coaching-session note-taker. Always respond with valid JSON matching the requested schema. Never invent facts.',
      },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('LLM returned an empty response.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `LLM returned invalid JSON: ${(err as Error).message}`
    );
  }

  const notes = StructuredNotesSchema.parse(parsed);

  return {
    notes,
    tokensUsed: completion.usage?.total_tokens ?? 0,
    model: SESSION_NOTES_MODEL,
  };
}

/**
 * Concatenate the four SOAP sections into a single plain-text string suitable
 * for the legacy `session_notes.content` column.
 */
export function concatSoap(notes: StructuredNotes): string {
  const sections: Array<[string, string]> = [
    ['Subjective', notes.soapSubjective],
    ['Objective', notes.soapObjective],
    ['Assessment', notes.soapAssessment],
    ['Plan', notes.soapPlan],
  ];
  return sections
    .filter(([, value]) => value.trim().length > 0)
    .map(([label, value]) => `## ${label}\n${value.trim()}`)
    .join('\n\n');
}
