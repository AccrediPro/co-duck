import { createClient } from '@supabase/supabase-js';

const MESSAGE_ATTACHMENTS_BUCKET = 'message-attachments';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_EXTENSIONS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const ALLOWED_MIME_TYPES = Object.values(ALLOWED_EXTENSIONS);

export interface UploadResult {
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface UploadError {
  code: string;
  message: string;
}

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

function getExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

export function validateFile(file: File): UploadError | null {
  if (file.size > MAX_FILE_SIZE) {
    return { code: 'FILE_TOO_LARGE', message: 'File exceeds 5MB limit' };
  }

  const ext = getExtension(file.name);
  if (!ext || !ALLOWED_EXTENSIONS[ext]) {
    return {
      code: 'INVALID_FILE_TYPE',
      message: 'Allowed types: JPEG, PNG, WebP, GIF, PDF, DOC, DOCX',
    };
  }

  const expectedMime = ALLOWED_EXTENSIONS[ext];
  if (file.type !== expectedMime) {
    return {
      code: 'MIME_MISMATCH',
      message: 'File extension does not match content type',
    };
  }

  return null;
}

export async function uploadMessageAttachment(
  file: File,
  conversationId: number,
  senderId: string
): Promise<{ data: UploadResult } | { error: UploadError }> {
  const validationError = validateFile(file);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { error: { code: 'STORAGE_ERROR', message: 'Storage not configured' } };
  }

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === MESSAGE_ATTACHMENTS_BUCKET);
  if (!bucketExists) {
    await supabase.storage.createBucket(MESSAGE_ATTACHMENTS_BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
  }

  const sanitized = sanitizeFileName(file.name);
  const filePath = `${conversationId}/${senderId}/${Date.now()}-${sanitized}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('Message attachment upload error:', uploadError);
    return { error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file' } };
  }

  const { data: urlData } = supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .getPublicUrl(filePath);

  return {
    data: {
      url: urlData.publicUrl,
      fileName: file.name.slice(0, 255),
      fileType: file.type,
      fileSize: file.size,
    },
  };
}
