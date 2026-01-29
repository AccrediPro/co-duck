ALTER TABLE "coach_profiles" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "stripe_onboarding_complete" boolean DEFAULT false NOT NULL;