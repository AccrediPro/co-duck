CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "verification_status" "verification_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "verified_at" timestamp with time zone;