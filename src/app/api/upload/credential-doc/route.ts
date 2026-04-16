import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, SENSITIVE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

const BUCKET_NAME = 'credentials';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase config for credential-doc upload');
    return null;
  }
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, SENSITIVE_LIMIT, 'upload-credential-doc');
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
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

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_FILE', message: 'No file provided' } },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_TYPE', message: 'Allowed types: JPG, PNG, WebP, PDF' },
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_TOO_LARGE', message: 'Maximum file size is 2MB' } },
        { status: 400 }
      );
    }

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!bucketExists) {
      const { error: bucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false, // Credentials are private
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
      if (bucketError) {
        console.error('Failed to create credentials bucket:', bucketError);
        return NextResponse.json(
          {
            success: false,
            error: { code: 'STORAGE_ERROR', message: 'Storage configuration error' },
          },
          { status: 500 }
        );
      }
    }

    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Credential doc upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file' } },
        { status: 500 }
      );
    }

    // Return a signed URL (1 year expiry) since bucket is private
    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 365 * 24 * 60 * 60);

    if (signedUrlError || !signedUrl) {
      return NextResponse.json(
        { success: false, error: { code: 'URL_ERROR', message: 'Failed to generate file URL' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { url: signedUrl.signedUrl, path: fileName } });
  } catch (error) {
    console.error('Credential doc upload error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } },
      { status: 500 }
    );
  }
}
