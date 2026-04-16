-- Migration 0031: Tiered SaaS Subscriptions (P0-07)
-- Adds: coach_subscriptions table
-- Enums: billing_interval, subscription_status

--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."billing_interval" AS ENUM('monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'incomplete');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coach_subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "coach_id" text NOT NULL,
  "plan_id" text NOT NULL DEFAULT 'starter',
  "billing_interval" "billing_interval" NOT NULL DEFAULT 'monthly',
  "stripe_subscription_id" text,
  "stripe_customer_id" text,
  "status" "subscription_status" NOT NULL DEFAULT 'trialing',
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "trial_ends_at" timestamp with time zone,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
ALTER TABLE "coach_subscriptions"
  ADD CONSTRAINT "coach_subscriptions_coach_id_users_id_fk"
  FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coach_subscriptions_coach_id_idx" ON "coach_subscriptions" USING btree ("coach_id");
CREATE INDEX IF NOT EXISTS "coach_subscriptions_status_idx" ON "coach_subscriptions" USING btree ("status");
CREATE INDEX IF NOT EXISTS "coach_subscriptions_stripe_sub_id_idx" ON "coach_subscriptions" USING btree ("stripe_subscription_id");
