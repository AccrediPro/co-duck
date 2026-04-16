/**
 * @fileoverview POST /api/onboarding/coach/apply-draft
 *
 * Persists an edited coach profile draft (from the one-page quick onboarding
 * flow) to the database. Creates or updates the coach's `coach_profiles` row,
 * writes credentials + session types, updates the `users` row (name, role),
 * and optionally publishes the profile in one transaction-less pass.
 *
 * This is the counterpart to `/api/onboarding/coach/ai-draft`: the frontend
 * receives a draft from the AI, lets the coach edit inline, then POSTs the
 * final object here.
 *
 * @module api/onboarding/coach/apply-draft
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq, and, ne } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { db } from '@/db';
import { coachProfiles, users } from '@/db/schema';
import type { Credential, SessionType } from '@/db/schema';
import {
  coachBasicInfoSchema,
  specialtyEntrySchema,
  sessionTypeSchema,
  credentialSchema,
  generateSlug,
  COACH_CATEGORIES,
  SUPPORTED_CURRENCIES,
} from '@/lib/validators/coach-onboarding';
import { rateLimit } from '@/lib/rate-limit';
import type { RateLimitConfig } from '@/lib/rate-limit';

/** 10 writes per minute. */
const APPLY_DRAFT_LIMIT: RateLimitConfig = { limit: 10, windowMs: 60_000 };

export const runtime = 'nodejs';

/* ==========================================================================
   Request schema
   ==========================================================================

   The frontend sends back whatever the coach has (possibly edited). We validate
   each section independently so a bad credential doesn't kill the whole save.
*/

const draftCredentialInputSchema = z.object({
  /** Client-generated UUID for stable React keys — we generate server-side if missing. */
  id: z.string().uuid().optional(),
  type: z.enum(['certification', 'degree', 'license', 'membership']),
  title: z.string().trim().min(1).max(200),
  issuer: z.string().trim().min(1).max(200),
  issuedYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable(),
  credentialId: z.string().trim().max(100).nullable().optional(),
  verificationUrl: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().url().nullable().optional()
  ),
});

const draftSessionTypeInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  duration: z.number().int().min(15).max(180),
  priceCents: z.number().int().min(0),
});

const applyDraftSchema = z.object({
  /* Step 1 — basic info */
  displayName: z.string().trim().min(2).max(100),
  headline: z.string().trim().min(10).max(150),
  profilePhotoUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  timezone: z.string().min(1),

  /* Step 2 — bio + specialties */
  bio: z.string().trim().min(0).max(2000),
  specialties: z.array(specialtyEntrySchema).min(1).max(3),

  /* Step 3 — pricing */
  currency: z.string().refine((v) => SUPPORTED_CURRENCIES.some((c) => c.code === v), {
    message: 'Currency not supported',
  }),
  sessionTypes: z.array(draftSessionTypeInputSchema).min(1).max(6),
  hourlyRateCents: z.number().int().min(0).nullable().optional(),

  /* Credentials — optional */
  credentials: z.array(draftCredentialInputSchema).max(20).default([]),

  /* Publish flag */
  publish: z.boolean().default(false),
});

type ApplyDraftBody = z.infer<typeof applyDraftSchema>;

/* ==========================================================================
   Response envelope
   ========================================================================== */

type ApplyDraftResponse =
  | { success: true; data: { slug: string; isPublished: boolean } }
  | { success: false; error: { code: string; message: string } };

function err(
  code: string,
  message: string,
  status: number,
  headers?: Record<string, string>
): NextResponse<ApplyDraftResponse> {
  return NextResponse.json<ApplyDraftResponse>(
    { success: false, error: { code, message } },
    { status, headers }
  );
}

/* ==========================================================================
   Transform helpers — from draft shape to DB shape
   ========================================================================== */

/**
 * Filters specialties to known categories and sub-niches (defence in depth —
 * even though the client validates, we don't trust client input).
 */
function sanitizeSpecialties(input: ApplyDraftBody['specialties']): ApplyDraftBody['specialties'] {
  return input
    .map((entry) => {
      const cat = COACH_CATEGORIES.find((c) => c.label === entry.category);
      if (!cat) return null;
      const validSubLabels = new Set(cat.subNiches.map((s) => s.label));
      return {
        category: cat.label,
        subNiches: entry.subNiches.filter((s) => validSubLabels.has(s)),
      };
    })
    .filter((e): e is { category: string; subNiches: string[] } => e !== null);
}

/**
 * Assigns stable IDs to session types. Matches the existing wizard's format:
 * `session_{timestamp}_{random7chars}`.
 */
function toSessionTypes(input: ApplyDraftBody['sessionTypes']): SessionType[] {
  return input.map((st, i) => ({
    id: st.id && st.id.length > 0 ? st.id : `session_${Date.now()}_${i}${randomSuffix(6)}`,
    name: st.name,
    duration: st.duration,
    price: st.priceCents,
  }));
}

function randomSuffix(len: number): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len);
}

/**
 * Strips draft-specific flexibility (nullable issuedYear) and assigns UUIDs.
 * `verifiedAt` / `verifiedBy` are NEVER accepted from the client — only the
 * admin verification endpoint may set those.
 */
function toCredentials(input: ApplyDraftBody['credentials']): Credential[] {
  return input
    .filter((c) => c.issuedYear !== null)
    .map((c) => ({
      id: c.id && isUuid(c.id) ? c.id : randomUUID(),
      type: c.type,
      title: c.title,
      issuer: c.issuer,
      issuedYear: c.issuedYear as number,
      ...(c.credentialId ? { credentialId: c.credentialId } : {}),
      ...(c.verificationUrl ? { verificationUrl: c.verificationUrl } : {}),
    }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/**
 * Picks a slug that doesn't collide with another coach's slug. Keeps the
 * existing slug if we already have a profile (editing doesn't rename).
 */
async function pickSlug(userId: string, displayName: string): Promise<string> {
  const existing = await db
    .select({ slug: coachProfiles.slug })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);
  if (existing.length > 0) return existing[0].slug;

  const base = generateSlug(displayName);
  // Check uniqueness; if taken by a different user, append a 6-char suffix.
  const taken = await db
    .select({ userId: coachProfiles.userId })
    .from(coachProfiles)
    .where(and(eq(coachProfiles.slug, base), ne(coachProfiles.userId, userId)))
    .limit(1);
  if (taken.length === 0) return base;
  return `${base}-${randomSuffix(6)}`;
}

/* ==========================================================================
   Handler
   ========================================================================== */

export async function POST(request: Request): Promise<NextResponse<ApplyDraftResponse>> {
  const { userId } = await auth();
  if (!userId) {
    return err('UNAUTHORIZED', 'You must be signed in to apply a draft.', 401);
  }

  const rl = rateLimit(request, APPLY_DRAFT_LIMIT, 'onboarding-apply-draft');
  if (!rl.success) {
    return err('RATE_LIMITED', rl.message, 429, rl.headers);
  }

  let body: ApplyDraftBody;
  try {
    const json = await request.json();
    const parsed = applyDraftSchema.safeParse(json);
    if (!parsed.success) {
      return err('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    }
    body = parsed.data;
  } catch {
    return err('INVALID_JSON', 'Request body was not valid JSON.', 400);
  }

  /* Secondary validation on the basic-info section (reuse the step-1 schema). */
  const basicCheck = coachBasicInfoSchema.safeParse({
    displayName: body.displayName,
    headline: body.headline,
    profilePhotoUrl: body.profilePhotoUrl ?? '',
    timezone: body.timezone,
  });
  if (!basicCheck.success) {
    return err('INVALID_INPUT', basicCheck.error.issues[0]?.message ?? 'Invalid basic info', 400);
  }

  /* Validate each session type via the canonical wizard schema. */
  for (const st of body.sessionTypes) {
    const candidate = {
      id: st.id ?? 'session_placeholder_1',
      name: st.name,
      duration: st.duration,
      price: st.priceCents,
    };
    const check = sessionTypeSchema.safeParse(candidate);
    if (!check.success) {
      return err(
        'INVALID_INPUT',
        `Session type "${st.name}": ${check.error.issues[0]?.message ?? 'invalid'}`,
        400
      );
    }
  }

  /* Validate each credential via the canonical credential schema (sans verifiedAt/By). */
  for (const c of body.credentials) {
    if (c.issuedYear === null) continue; // caller intentionally left blank → we drop it
    const candidate = {
      id: c.id ?? randomUUID(),
      type: c.type,
      title: c.title,
      issuer: c.issuer,
      issuedYear: c.issuedYear,
      credentialId: c.credentialId ?? null,
      verificationUrl: c.verificationUrl ?? null,
    };
    const check = credentialSchema.safeParse(candidate);
    if (!check.success) {
      return err(
        'INVALID_INPUT',
        `Credential "${c.title}": ${check.error.issues[0]?.message ?? 'invalid'}`,
        400
      );
    }
  }

  const sanitizedSpecialties = sanitizeSpecialties(body.specialties);
  if (sanitizedSpecialties.length === 0) {
    return err('INVALID_INPUT', 'Please pick at least one valid specialty.', 400);
  }

  const sessionTypesDb = toSessionTypes(body.sessionTypes);
  const credentialsDb = toCredentials(body.credentials);

  const slug = await pickSlug(userId, body.displayName);

  /* Fire user update + profile upsert. */
  await db
    .update(users)
    .set({
      name: body.displayName,
      avatarUrl: body.profilePhotoUrl ?? null,
      role: 'coach',
    })
    .where(eq(users.id, userId));

  const existing = await db
    .select({ userId: coachProfiles.userId })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);

  const completion = computeCompletion({
    hasHeadline: body.headline.length >= 10,
    hasTimezone: body.timezone.length > 0,
    hasDisplayName: body.displayName.length > 0,
    hasAvatar: Boolean(body.profilePhotoUrl),
    hasBio: body.bio.length > 0,
    hasSpecialties: sanitizedSpecialties.length > 0,
    hasCurrency: body.currency.length > 0,
    hasSessionTypes: sessionTypesDb.length > 0,
  });

  if (existing.length === 0) {
    await db.insert(coachProfiles).values({
      userId,
      slug,
      headline: body.headline,
      bio: body.bio || null,
      specialties: sanitizedSpecialties,
      currency: body.currency,
      sessionTypes: sessionTypesDb,
      credentials: credentialsDb,
      hourlyRate: body.hourlyRateCents ?? null,
      timezone: body.timezone,
      profileCompletionPercentage: completion,
      isPublished: body.publish,
    });
  } else {
    await db
      .update(coachProfiles)
      .set({
        headline: body.headline,
        bio: body.bio || null,
        specialties: sanitizedSpecialties,
        currency: body.currency,
        sessionTypes: sessionTypesDb,
        credentials: credentialsDb,
        hourlyRate: body.hourlyRateCents ?? null,
        timezone: body.timezone,
        profileCompletionPercentage: completion,
        isPublished: body.publish,
      })
      .where(eq(coachProfiles.userId, userId));
  }

  return NextResponse.json<ApplyDraftResponse>(
    { success: true, data: { slug, isPublished: body.publish } },
    { headers: rl.headers }
  );
}

/**
 * Simple completion score: each truthy flag = 12.5%. 8 flags → 100%.
 */
function computeCompletion(flags: Record<string, boolean>): number {
  const total = Object.values(flags).length;
  const hit = Object.values(flags).filter(Boolean).length;
  return Math.round((hit / total) * 100);
}
