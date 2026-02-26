import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/db';
import { attachments, programs, goals, actionItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

const BUCKET_NAME = 'coaching-materials';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 100);
}

async function verifyParticipant(
  userId: string,
  programId: number | null,
  goalId: number | null,
  actionItemId: number | null
): Promise<{ coachId: string; clientId: string } | null> {
  if (programId) {
    const [program] = await db
      .select({ coachId: programs.coachId, clientId: programs.clientId })
      .from(programs)
      .where(eq(programs.id, programId))
      .limit(1);

    if (!program) return null;
    if (program.coachId !== userId && program.clientId !== userId) return null;
    return program;
  }

  if (goalId) {
    const [goal] = await db
      .select({ coachId: goals.coachId, clientId: goals.clientId })
      .from(goals)
      .where(eq(goals.id, goalId))
      .limit(1);

    if (!goal) return null;
    if (goal.coachId !== userId && goal.clientId !== userId) return null;
    return goal;
  }

  if (actionItemId) {
    const [item] = await db
      .select({ coachId: actionItems.coachId, clientId: actionItems.clientId })
      .from(actionItems)
      .where(eq(actionItems.id, actionItemId))
      .limit(1);

    if (!item) return null;
    if (item.coachId !== userId && item.clientId !== userId) return null;
    return item;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, WRITE_LIMIT, 'attachments-upload');
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return Response.json(
        { success: false, error: { code: 'STORAGE_ERROR', message: 'Storage not configured' } },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const programIdStr = formData.get('programId') as string | null;
    const goalIdStr = formData.get('goalId') as string | null;
    const actionItemIdStr = formData.get('actionItemId') as string | null;

    if (!file) {
      return Response.json(
        { success: false, error: { code: 'MISSING_FILE', message: 'No file provided' } },
        { status: 400 }
      );
    }

    const programId = programIdStr ? parseInt(programIdStr, 10) : null;
    const goalId = goalIdStr ? parseInt(goalIdStr, 10) : null;
    const actionItemId = actionItemIdStr ? parseInt(actionItemIdStr, 10) : null;

    if (
      (programId !== null && isNaN(programId)) ||
      (goalId !== null && isNaN(goalId)) ||
      (actionItemId !== null && isNaN(actionItemId))
    ) {
      return Response.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: 'Invalid ID parameter' } },
        { status: 400 }
      );
    }

    if (!programId && !goalId && !actionItemId) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'MISSING_PARENT',
            message: 'At least one of programId, goalId, or actionItemId is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate file size before reading
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        {
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 10MB limit' },
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Allowed types: PDF, JPEG, PNG, WebP, DOC, DOCX',
          },
        },
        { status: 400 }
      );
    }

    // Verify user is a participant in the coaching relationship
    const participant = await verifyParticipant(userId, programId, goalId, actionItemId);
    if (!participant) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not a participant in this relationship' },
        },
        { status: 403 }
      );
    }

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
    }

    // Build storage path: {coachId}/{clientId}/{timestamp}-{sanitizedFileName}
    const sanitized = sanitizeFileName(file.name);
    const filePath = `${participant.coachId}/${participant.clientId}/${Date.now()}-${sanitized}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Attachment upload error:', uploadError);
      return Response.json(
        { success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file' } },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    // Insert attachment record
    const [attachment] = await db
      .insert(attachments)
      .values({
        programId,
        goalId,
        actionItemId,
        uploadedBy: userId,
        fileName: file.name.slice(0, 255),
        fileUrl: urlData.publicUrl,
        fileType: file.type,
        fileSize: file.size,
      })
      .returning();

    return Response.json({ success: true, data: attachment }, { status: 201 });
  } catch (error) {
    console.error('Attachment upload error:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } },
      { status: 500 }
    );
  }
}
