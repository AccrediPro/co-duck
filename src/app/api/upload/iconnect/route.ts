import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, SENSITIVE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

const BUCKET_NAME = 'iconnect-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY. File uploads require the service role key.');
    return null;
  }
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, SENSITIVE_LIMIT, 'upload-iconnect');
  if (!rl.success) return rateLimitResponse(rl);

  try {
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

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'No file provided' } },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_FILE_TYPE', message: 'Allowed: JPG, PNG, WebP' },
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 5MB limit' } },
        { status: 400 }
      );
    }

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: bucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
      if (bucketError) {
        console.error('Failed to create iconnect-images bucket:', bucketError);
        return NextResponse.json(
          {
            success: false,
            error: { code: 'STORAGE_ERROR', message: 'File storage is not configured' },
          },
          { status: 500 }
        );
      }
    }

    // Generate unique filename: iconnect/{userId}/{timestamp}-{sanitized}
    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const sanitized = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 80);
    const fileName = `${userId}/${Date.now()}-${sanitized}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('iConnect image upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file' } },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      data: { url: urlData.publicUrl },
    });
  } catch (error) {
    console.error('iConnect image upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred during upload' },
      },
      { status: 500 }
    );
  }
}
