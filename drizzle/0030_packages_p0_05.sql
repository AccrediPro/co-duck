-- Migration 0030: Multi-Session Packages (P0-05)
-- Adds: packages, package_purchases tables + bookings.package_purchase_id column
-- Enums: package_purchase_status

--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."package_purchase_status" AS ENUM('active', 'expired', 'completed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "packages" (
  "id" serial PRIMARY KEY NOT NULL,
  "coach_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "session_count" integer NOT NULL,
  "session_duration" integer NOT NULL,
  "price_cents" integer NOT NULL,
  "original_price_cents" integer,
  "validity_days" integer NOT NULL DEFAULT 180,
  "is_published" boolean NOT NULL DEFAULT false,
  "session_type_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
ALTER TABLE "packages"
  ADD CONSTRAINT "packages_coach_id_users_id_fk"
  FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "packages_coach_id_idx" ON "packages" USING btree ("coach_id");
CREATE INDEX IF NOT EXISTS "packages_is_published_idx" ON "packages" USING btree ("is_published");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "package_purchases" (
  "id" serial PRIMARY KEY NOT NULL,
  "package_id" integer NOT NULL,
  "client_id" text NOT NULL,
  "coach_id" text NOT NULL,
  "purchased_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  "total_sessions" integer NOT NULL,
  "used_sessions" integer NOT NULL DEFAULT 0,
  "total_paid_cents" integer NOT NULL,
  "platform_fee_cents" integer NOT NULL,
  "coach_payout_cents" integer NOT NULL,
  "status" "package_purchase_status" NOT NULL DEFAULT 'active',
  "stripe_payment_intent_id" text,
  "stripe_checkout_session_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
ALTER TABLE "package_purchases"
  ADD CONSTRAINT "package_purchases_package_id_packages_id_fk"
  FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "package_purchases"
  ADD CONSTRAINT "package_purchases_client_id_users_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "package_purchases"
  ADD CONSTRAINT "package_purchases_coach_id_users_id_fk"
  FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "package_purchases_client_id_idx" ON "package_purchases" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "package_purchases_coach_id_idx" ON "package_purchases" USING btree ("coach_id");
CREATE INDEX IF NOT EXISTS "package_purchases_package_id_idx" ON "package_purchases" USING btree ("package_id");
CREATE INDEX IF NOT EXISTS "package_purchases_status_idx" ON "package_purchases" USING btree ("status");

--> statement-breakpoint
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "package_purchase_id" integer;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_package_purchase_id_idx" ON "bookings" USING btree ("package_purchase_id");
