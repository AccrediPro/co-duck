/**
 * @fileoverview POST /api/onboarding/coach/ai-draft
 *
 * Takes a source URL, pasted text, or both, scrapes if a URL is provided,
 * and returns a structured AI-generated coach profile draft.
 *
 * This is the heart of P0-11's one-shot onboarding: the coach goes from
 * "paste your LinkedIn" to a fully populated (editable) profile in one
 * round-trip.
 *
 * @module api/onboarding/coach/ai-draft
 */

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';

import { rateLimit } from '@/lib/rate-limit';
import type { RateLimitConfig } from '@/lib/rate-limit';
import { scrapeUrl, LinkedInBlockedError, ScrapeFailedError } from '@/lib/ai/scrape';
import { generateCoachDraft, DraftGenerationError, type CoachDraft } from '@/lib/ai/coach-draft';
import { isOpenAIConfigured } from '@/lib/ai/openai';

/** 5 requests per minute — AI calls are expensive. */
const AI_DRAFT_LIMIT: RateLimitConfig = { limit: 5, windowMs: 60_000 };

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    sourceUrl: z.string().trim().url().optional().or(z.literal('')),
    sourceText: z.string().trim().max(20_000).optional().or(z.literal('')),
  })
  .refine(
    (v) => (v.sourceUrl && v.sourceUrl.length > 0) || (v.sourceText && v.sourceText.length > 0),
    {
      message: 'Provide either a source URL or pasted text.',
    }
  );

/**
 * Response envelope matches the project convention:
 * `{ success: true, data }` on success, `{ success: false, error: { code, message } }` on failure.
 */
type DraftResponse =
  | {
      success: true;
      data: {
        draft: CoachDraft;
        sourceInfo: { url?: string; title?: string; truncated?: boolean };
      };
    }
  | { success: false; error: { code: string; message: string } };

function err(
  code: string,
  message: string,
  status: number,
  headers?: Record<string, string>
): NextResponse<DraftResponse> {
  return NextResponse.json<DraftResponse>(
    { success: false, error: { code, message } },
    { status, headers }
  );
}

export async function POST(request: Request): Promise<NextResponse<DraftResponse>> {
  /* Auth — must be a signed-in user (we check coach-role enforcement at apply time). */
  const { userId } = await auth();
  if (!userId) {
    return err('UNAUTHORIZED', 'You must be signed in to generate a draft.', 401);
  }

  /* Rate-limit per-IP + per-endpoint. */
  const rl = rateLimit(request, AI_DRAFT_LIMIT, 'onboarding-ai-draft');
  if (!rl.success) {
    return err('RATE_LIMITED', rl.message, 429, rl.headers);
  }

  /* Feature-gate — if no OpenAI key, return a clear error rather than a 500. */
  if (!isOpenAIConfigured()) {
    return err(
      'AI_UNAVAILABLE',
      'AI drafting is not configured on this environment. Please use the manual onboarding steps.',
      503
    );
  }

  /* Parse body. */
  let body: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return err('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    }
    body = parsed.data;
  } catch {
    return err('INVALID_JSON', 'Request body was not valid JSON.', 400);
  }

  /* Gather source text. */
  let sourceText = body.sourceText?.trim() ?? '';
  let sourceUrl = body.sourceUrl?.trim() || undefined;
  let sourceTitle: string | undefined;

  if (sourceUrl && !sourceText) {
    try {
      const scraped = await scrapeUrl(sourceUrl);
      sourceText = scraped.text;
      sourceTitle = scraped.title;
      sourceUrl = scraped.url;
    } catch (e) {
      if (e instanceof LinkedInBlockedError) {
        return err('LINKEDIN_BLOCKED', e.message, 422);
      }
      if (e instanceof ScrapeFailedError) {
        return err('SCRAPE_FAILED', e.message, 422);
      }
      return err('SCRAPE_FAILED', `Failed to fetch the provided URL: ${(e as Error).message}`, 422);
    }
  }

  if (!sourceText || sourceText.length < 40) {
    return err(
      'NOT_ENOUGH_TEXT',
      'We need at least a short bio (about 40+ characters) to draft a profile.',
      400
    );
  }

  /* Prime the model with the user's display name if available. */
  const user = await currentUser();
  const coachName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : undefined;

  /* Generate. */
  let draft: CoachDraft;
  try {
    draft = await generateCoachDraft({ sourceText, coachName, sourceUrl });
  } catch (e) {
    if (e instanceof DraftGenerationError) {
      return err('DRAFT_FAILED', e.message, 502);
    }
    return err('DRAFT_FAILED', `AI draft generation failed: ${(e as Error).message}`, 502);
  }

  return NextResponse.json<DraftResponse>(
    {
      success: true,
      data: {
        draft,
        sourceInfo: {
          url: sourceUrl,
          title: sourceTitle,
          truncated: sourceText.length >= 12_000,
        },
      },
    },
    { headers: rl.headers }
  );
}
