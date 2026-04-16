/**
 * @fileoverview AI Session Notes API (P0-10)
 *
 * Kicks off AI processing for a session, polls status, and lets coaches edit
 * the structured notes before finalizing. Coach-only throughout.
 *
 * Routes:
 * - `POST   /api/bookings/:id/ai-notes` → start processing (audio path or transcript)
 * - `GET    /api/bookings/:id/ai-notes` → fetch current notes + processing status
 * - `PATCH  /api/bookings/:id/ai-notes` → coach edits any structured field
 *
 * Processing is fire-and-forget on the server: the POST returns immediately
 * with `processingStatus='transcribing'` (or `'generating'` when a transcript
 * was pasted directly), and a background async task updates the row as it
 * progresses. The UI polls GET every few seconds.
 *
 * @module api/bookings/[id]/ai-notes
 */

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { db, bookings, sessionNotes, users } from '@/db';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { formatDateLong } from '@/lib/date-utils';
import { transcribeAudio } from '@/lib/ai/transcribe';
import { generateSessionNotes, concatSoap } from '@/lib/ai/session-notes';

const RECORDINGS_BUCKET = 'session-recordings';
const SIGNED_URL_TTL_SECONDS = 600; // 10 minutes — just long enough for Whisper

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ---------- helpers ----------

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function unauthorized() {
  return json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
    { status: 401 }
  );
}

function forbidden() {
  return json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only the session coach can access AI notes.',
      },
    },
    { status: 403 }
  );
}

function badRequest(code: string, message: string) {
  return json({ success: false, error: { code, message } }, { status: 400 });
}

function notFound() {
  return json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } },
    { status: 404 }
  );
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Load the booking and confirm the caller is its coach.
 * Returns `{ booking }` or a Response to return immediately.
 */
async function loadBookingAsCoach(
  bookingId: number,
  userId: string
): Promise<{ booking: typeof bookings.$inferSelect } | Response> {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
  });
  if (!booking) return notFound();
  if (booking.coachId !== userId) return forbidden();
  return { booking };
}

function parseBookingId(id: string): number | null {
  const parsed = Number(id);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// ---------- background processing ----------

interface ProcessArgs {
  bookingId: number;
  coachId: string;
  coachName: string;
  clientName: string;
  sessionType: string;
  sessionDate: string;
  /** Either audio storage path OR a raw transcript (exactly one) */
  audioStoragePath?: string;
  transcriptText?: string;
}

/**
 * Runs the Whisper → GPT-4o pipeline and writes results back to session_notes.
 * Errors are captured and stored in `processingError`; never throws.
 */
async function runProcessing(args: ProcessArgs): Promise<void> {
  const { bookingId, coachId } = args;

  try {
    let transcript = args.transcriptText?.trim() ?? '';

    // Phase 1: transcription
    if (!transcript && args.audioStoragePath) {
      await db
        .update(sessionNotes)
        .set({ processingStatus: 'transcribing', processingError: null })
        .where(eq(sessionNotes.bookingId, bookingId));

      const supabase = getSupabaseAdmin();
      if (!supabase) {
        throw new Error('Supabase service role key is not configured.');
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from(RECORDINGS_BUCKET)
        .createSignedUrl(args.audioStoragePath, SIGNED_URL_TTL_SECONDS);
      if (signErr || !signed?.signedUrl) {
        throw new Error(`Could not sign recording URL: ${signErr?.message ?? 'unknown'}`);
      }

      const result = await transcribeAudio(signed.signedUrl, {
        filename: args.audioStoragePath.split('/').pop(),
      });
      transcript = result.text;

      await db
        .update(sessionNotes)
        .set({ transcript: transcript })
        .where(eq(sessionNotes.bookingId, bookingId));
    }

    if (!transcript) {
      throw new Error('No transcript available to summarize.');
    }

    // Phase 2: structured generation
    await db
      .update(sessionNotes)
      .set({ processingStatus: 'generating' })
      .where(eq(sessionNotes.bookingId, bookingId));

    const { notes, tokensUsed, model } = await generateSessionNotes(transcript, {
      coachName: args.coachName,
      clientName: args.clientName,
      sessionType: args.sessionType,
      sessionDate: args.sessionDate,
    });

    await db
      .update(sessionNotes)
      .set({
        transcript: transcript,
        soapSubjective: notes.soapSubjective,
        soapObjective: notes.soapObjective,
        soapAssessment: notes.soapAssessment,
        soapPlan: notes.soapPlan,
        keyTopics: notes.keyTopics,
        actionItemsSuggested: notes.actionItemsSuggested,
        nextSessionSuggestions: notes.nextSessionSuggestions,
        followUpEmailSubject: notes.followUpEmailSubject,
        followUpEmailBody: notes.followUpEmailBody,
        content: concatSoap(notes),
        aiGenerated: true,
        aiModel: model,
        aiGeneratedAt: new Date(),
        aiTokensUsed: tokensUsed,
        processingStatus: 'ready',
        processingError: null,
      })
      .where(eq(sessionNotes.bookingId, bookingId));

    // Cost guardrail — rough estimate at GPT-4o pricing ($5/1M tokens, mixed)
    const estimatedUsd = (tokensUsed / 1_000_000) * 5;
    if (estimatedUsd > 2) {
      console.warn(
        `[ai-notes] High cost estimate for booking ${bookingId} (coach=${coachId}): ~$${estimatedUsd.toFixed(2)}, ${tokensUsed} tokens`
      );
    }

    // Best-effort: delete the audio after successful transcription (minimize PHI)
    if (args.audioStoragePath) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        supabase.storage
          .from(RECORDINGS_BUCKET)
          .remove([args.audioStoragePath])
          .catch((err) => {
            console.warn('Failed to delete session recording after transcription:', err);
          });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[ai-notes] Processing failed for booking ${bookingId}:`, err);
    await db
      .update(sessionNotes)
      .set({ processingStatus: 'failed', processingError: message })
      .where(eq(sessionNotes.bookingId, bookingId))
      .catch((dbErr) => {
        console.error('[ai-notes] Could not persist failure state:', dbErr);
      });
  }
}

// ---------- route handlers ----------

const PostSchema = z
  .object({
    audioStoragePath: z.string().min(1).optional(),
    transcript: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.audioStoragePath) !== Boolean(v.transcript), {
    message: 'Provide exactly one of audioStoragePath or transcript.',
  });

export async function POST(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'ai-notes-start');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  const bookingId = parseBookingId(id);
  if (!bookingId) return badRequest('INVALID_ID', 'Invalid session id.');

  const loaded = await loadBookingAsCoach(bookingId, userId);
  if (loaded instanceof Response) return loaded;
  const { booking } = loaded;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('INVALID_BODY', 'Request body must be JSON.');
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  // Look up coach + client names for the prompt context
  const [coachUser, clientUser] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { name: true } }),
    db.query.users.findFirst({
      where: eq(users.id, booking.clientId),
      columns: { name: true },
    }),
  ]);

  // Upsert session_notes row with processing state + optional audio link
  const initialStatus = parsed.data.audioStoragePath ? 'transcribing' : 'generating';

  const existing = await db.query.sessionNotes.findFirst({
    where: eq(sessionNotes.bookingId, bookingId),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(sessionNotes)
      .set({
        processingStatus: initialStatus,
        processingError: null,
        transcriptUrl: parsed.data.audioStoragePath ?? null,
        transcript: parsed.data.transcript ?? null,
      })
      .where(eq(sessionNotes.bookingId, bookingId));
  } else {
    await db.insert(sessionNotes).values({
      bookingId,
      coachId: userId,
      content: '',
      processingStatus: initialStatus,
      transcriptUrl: parsed.data.audioStoragePath ?? null,
      transcript: parsed.data.transcript ?? null,
    });
  }

  const sessionTypeName =
    (booking.sessionType as { name?: string } | null)?.name ?? 'Coaching session';

  // Fire-and-forget background processing. We do NOT await.
  runProcessing({
    bookingId,
    coachId: userId,
    coachName: coachUser?.name ?? 'Coach',
    clientName: clientUser?.name ?? 'Client',
    sessionType: sessionTypeName,
    sessionDate: formatDateLong(booking.startTime),
    audioStoragePath: parsed.data.audioStoragePath,
    transcriptText: parsed.data.transcript,
  }).catch((err) => {
    console.error('[ai-notes] Uncaught processing error:', err);
  });

  return json({
    success: true,
    data: { processingStatus: initialStatus },
  });
}

export async function GET(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'ai-notes-get');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  const bookingId = parseBookingId(id);
  if (!bookingId) return badRequest('INVALID_ID', 'Invalid session id.');

  const loaded = await loadBookingAsCoach(bookingId, userId);
  if (loaded instanceof Response) return loaded;

  const note = await db.query.sessionNotes.findFirst({
    where: eq(sessionNotes.bookingId, bookingId),
  });

  if (!note) {
    return json({
      success: true,
      data: {
        exists: false,
        processingStatus: 'idle' as const,
      },
    });
  }

  return json({
    success: true,
    data: {
      exists: true,
      processingStatus: note.processingStatus,
      processingError: note.processingError,
      aiGenerated: note.aiGenerated,
      aiModel: note.aiModel,
      aiGeneratedAt: note.aiGeneratedAt,
      aiTokensUsed: note.aiTokensUsed,
      transcript: note.transcript,
      soapSubjective: note.soapSubjective,
      soapObjective: note.soapObjective,
      soapAssessment: note.soapAssessment,
      soapPlan: note.soapPlan,
      keyTopics: note.keyTopics,
      actionItemsSuggested: note.actionItemsSuggested,
      nextSessionSuggestions: note.nextSessionSuggestions,
      followUpEmailSubject: note.followUpEmailSubject,
      followUpEmailBody: note.followUpEmailBody,
      content: note.content,
      updatedAt: note.updatedAt,
    },
  });
}

const PatchSchema = z.object({
  soapSubjective: z.string().optional(),
  soapObjective: z.string().optional(),
  soapAssessment: z.string().optional(),
  soapPlan: z.string().optional(),
  keyTopics: z.array(z.string()).optional(),
  actionItemsSuggested: z.array(z.string()).optional(),
  nextSessionSuggestions: z.string().optional(),
  followUpEmailSubject: z.string().optional(),
  followUpEmailBody: z.string().optional(),
  content: z.string().optional(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, WRITE_LIMIT, 'ai-notes-patch');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { id } = await params;
  const bookingId = parseBookingId(id);
  if (!bookingId) return badRequest('INVALID_ID', 'Invalid session id.');

  const loaded = await loadBookingAsCoach(bookingId, userId);
  if (loaded instanceof Response) return loaded;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('INVALID_BODY', 'Request body must be JSON.');
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return badRequest('NO_UPDATES', 'No valid fields provided.');
  }

  // Ensure the row exists (coach may edit before AI ever runs)
  const existing = await db.query.sessionNotes.findFirst({
    where: eq(sessionNotes.bookingId, bookingId),
    columns: { id: true },
  });

  if (!existing) {
    await db.insert(sessionNotes).values({
      bookingId,
      coachId: userId,
      content: updates.content ?? '',
      ...updates,
    });
    return json({ success: true, data: { created: true } });
  }

  await db.update(sessionNotes).set(updates).where(eq(sessionNotes.bookingId, bookingId));

  return json({ success: true, data: { updated: true } });
}
