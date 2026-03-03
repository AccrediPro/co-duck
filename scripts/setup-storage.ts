/**
 * Setup Supabase Storage buckets required by the application.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Usage: npx tsx scripts/setup-storage.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const BUCKETS = [
  {
    name: 'avatars',
    public: true,
    fileSizeLimit: 500 * 1024, // 500KB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    name: 'coaching-materials',
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  {
    name: 'message-attachments',
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing required environment variables:');
    if (!url) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    if (!key) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nAdd SUPABASE_SERVICE_ROLE_KEY to .env (find it in Supabase Dashboard → Settings → API)');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: existing } = await supabase.storage.listBuckets();
  const existingNames = new Set(existing?.map((b) => b.name) || []);

  for (const bucket of BUCKETS) {
    if (existingNames.has(bucket.name)) {
      console.log(`✓ Bucket "${bucket.name}" already exists`);
      continue;
    }

    const { error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.allowedMimeTypes,
    });

    if (error) {
      console.error(`✗ Failed to create "${bucket.name}":`, error.message);
    } else {
      console.log(`✓ Created bucket "${bucket.name}"`);
    }
  }

  console.log('\nStorage setup complete.');
}

main();
