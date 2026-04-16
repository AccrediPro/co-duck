-- Migration: 0033_ai_session_notes
-- Purpose: Add AI-assisted session note generation (P0-10)
--   - New enum ai_processing_status
--   - Extend session_notes with transcript, SOAP fields, key topics, action item
--     suggestions, drafted follow-up email, processing status, token count
--   - Make session_notes.content default to empty string so rows can be created
--     while AI processing is still in-flight

-- 1. Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_processing_status') THEN
    CREATE TYPE "public"."ai_processing_status" AS ENUM (
      'idle',
      'uploading',
      'transcribing',
      'generating',
      'ready',
      'failed'
    );
  END IF;
END$$;

-- 2. Make content default to empty string (keep NOT NULL)
ALTER TABLE "session_notes" ALTER COLUMN "content" SET DEFAULT '';

-- 3. Add new columns (idempotent via IF NOT EXISTS)
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "transcript_url" text;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "transcript" text;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "ai_generated" boolean DEFAULT false NOT NULL;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "ai_model" text;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "ai_generated_at" timestamp with time zone;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "soap_subjective" text;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "soap_objective" text;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "soap_assessment" text;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "soap_plan" text;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "key_topics" jsonb;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "action_items_suggested" jsonb;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "next_session_suggestions" text;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "follow_up_email_subject" text;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "follow_up_email_body" text;
ALTER TABLE "session_notes"
  ADD COLUMN IF NOT EXISTS "processing_status" "public"."ai_processing_status"
  DEFAULT 'idle' NOT NULL;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "processing_error" text;
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "ai_tokens_used" integer;

-- 4. Index for polling status lookups
CREATE INDEX IF NOT EXISTS "session_notes_processing_status_idx"
  ON "session_notes" USING btree ("processing_status");
