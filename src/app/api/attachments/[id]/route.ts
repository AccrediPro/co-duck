import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/db';
import { attachments, programs, goals, actionItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { rateLimit, WRITE_LIMIT, DEFAULT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getAttachmentWithAuth(attachmentId: number, userId: string) {
  const [attachment] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1);

  if (!attachment) return { attachment: null, authorized: false, isCoach: false };

  // Check participation via the parent entity
  let coachId: string | null = null;
  let clientId: string | null = null;

  if (attachment.programId) {
    const [program] = await db
      .select({ coachId: programs.coachId, clientId: programs.clientId })
      .from(programs)
      .where(eq(programs.id, attachment.programId))
      .limit(1);
    if (program) {
      coachId = program.coachId;
      clientId = program.clientId;
    }
  } else if (attachment.goalId) {
    const [goal] = await db
      .select({ coachId: goals.coachId, clientId: goals.clientId })
      .from(goals)
      .where(eq(goals.id, attachment.goalId))
      .limit(1);
    if (goal) {
      coachId = goal.coachId;
      clientId = goal.clientId;
    }
  } else if (attachment.actionItemId) {
    const [item] = await db
      .select({ coachId: actionItems.coachId, clientId: actionItems.clientId })
      .from(actionItems)
      .where(eq(actionItems.id, attachment.actionItemId))
      .limit(1);
    if (item) {
      coachId = item.coachId;
      clientId = item.clientId;
    }
  }

  const authorized = userId === coachId || userId === clientId;
  const isCoach = userId === coachId;

  return { attachment, authorized, isCoach };
}

function extractStoragePath(fileUrl: string): string | null {
  // URL format: https://<project>.supabase.co/storage/v1/object/public/coaching-materials/<path>
  const marker = '/coaching-materials/';
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  return fileUrl.slice(idx + marker.length);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = rateLimit(request, DEFAULT_LIMIT, 'attachments-get');
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const attachmentId = parseInt(id, 10);
    if (isNaN(attachmentId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid attachment ID' } },
        { status: 400 }
      );
    }

    const { attachment, authorized } = await getAttachmentWithAuth(attachmentId, userId);

    if (!attachment) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Attachment not found' } },
        { status: 404 }
      );
    }

    if (!authorized) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    return Response.json({ success: true, data: attachment });
  } catch (error) {
    console.error('Get attachment error:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = rateLimit(request, WRITE_LIMIT, 'attachments-delete');
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

    const { id } = await params;
    const attachmentId = parseInt(id, 10);
    if (isNaN(attachmentId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid attachment ID' } },
        { status: 400 }
      );
    }

    const { attachment, authorized, isCoach } = await getAttachmentWithAuth(attachmentId, userId);

    if (!attachment) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Attachment not found' } },
        { status: 404 }
      );
    }

    if (!authorized) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Only the uploader or the coach can delete
    if (attachment.uploadedBy !== userId && !isCoach) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the uploader or coach can delete' },
        },
        { status: 403 }
      );
    }

    // Delete from storage first
    const storagePath = extractStoragePath(attachment.fileUrl);
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('coaching-materials')
        .remove([storagePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue to delete DB record even if storage fails
      }
    }

    // Delete from database
    await db.delete(attachments).where(eq(attachments.id, attachmentId));

    return Response.json({ success: true, data: { id: attachmentId } });
  } catch (error) {
    console.error('Delete attachment error:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } },
      { status: 500 }
    );
  }
}
