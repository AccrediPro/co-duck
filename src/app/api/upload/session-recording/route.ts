/**
 * @fileoverview Upload Session Recording API (P0-10)
 *
 * Accepts an audio recording from a coach and uploads it to the **private**
 * Supabase Storage bucket `session-recordings`. Returns an internal storage
 * path (NOT a public URL) that the caller passes back to
 * `POST /api/bookings/[id]/ai-notes` to kick off processing.
 *
 * Security:
 * - Coach-only (must be the coach on the referenced booking)
 * - Audio files only (mp3, m4a, wav, webm, mp4)
 * - Hard cap at 25 MB (Whisper's limit)
 * - Bucket is created as private; object URLs are issued as short-lived signed URLs
 *
 * @module api/upload/session-recording
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { and, eq } from 'drizzle-orm';
import { db, bookings } from '@/db';
import { rateLimit, SENSITIVE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

const BUCKET_NAME = 'session-recordings';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB — Whisper's hard limit
const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Session recording uploads require the service role key.'
    );
    return null;
  }
  return createClient(url, key);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 100);
}

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function ensureBucket(supabase: SupabaseAdmin) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) return error;
  if (buckets?.some((b) => b.name === BUCKET_NAME)) return null;

  const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
  return createErr ?? null;
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, SENSITIVE_LIMIT, 'upload-session-recording');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: { code: 'STORAGE_ERROR', message: 'Storage not configured' } },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const bookingIdRaw = formData.get('bookingId');

  if (!file) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_FILE', message: 'No file provided' } },
      { status: 400 }
    );
  }

  const bookingId = Number(bookingIdRaw);
  if (!bookingIdRaw || !Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BOOKING', message: 'Invalid bookingId' } },
      { status: 400 }
    );
  }

  // Coach-only: must be the coach on this booking
  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), eq(bookings.coachId, userId)),
    columns: { id: true },
  });
  if (!booking) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the session coach can upload recordings.' },
      },
      { status: 403 }
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'Allowed formats: MP3, M4A, WAV, WebM, MP4',
        },
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File exceeds 25 MB limit (got ${Math.round(file.size / 1_000_000)} MB)`,
        },
      },
      { status: 400 }
    );
  }

  const bucketErr = await ensureBucket(supabase);
  if (bucketErr) {
    console.error('Failed to ensure session-recordings bucket:', bucketErr);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'BUCKET_ERROR', message: 'Recording storage is not configured.' },
      },
      { status: 500 }
    );
  }

  const sanitized = sanitizeFilename(file.name || 'recording.mp3');
  const storagePath = `${userId}/${bookingId}/${Date.now()}-${sanitized}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Session recording upload error:', uploadError);
    return NextResponse.json(
      { success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload recording.' } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      storagePath,
      bucket: BUCKET_NAME,
      bytes: file.size,
      contentType: file.type,
    },
  });
}
