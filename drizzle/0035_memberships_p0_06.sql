CREATE TYPE "public"."membership_subscription_status" AS ENUM('active', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TABLE "membership_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"membership_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"coach_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"status" "membership_subscription_status" DEFAULT 'incomplete' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"sessions_remaining_this_period" integer NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"monthly_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"sessions_per_period" integer NOT NULL,
	"includes_messaging" boolean DEFAULT true NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "membership_subscription_id" integer;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_subscriptions_membership_id_idx" ON "membership_subscriptions" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "membership_subscriptions_client_id_idx" ON "membership_subscriptions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "membership_subscriptions_coach_id_idx" ON "membership_subscriptions" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "membership_subscriptions_status_idx" ON "membership_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "membership_subscriptions_client_coach_status_idx" ON "membership_subscriptions" USING btree ("client_id","coach_id","status");--> statement-breakpoint
CREATE INDEX "memberships_coach_id_idx" ON "memberships" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "memberships_is_active_idx" ON "memberships" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_membership_subscription_id_membership_subscriptions_id_fk" FOREIGN KEY ("membership_subscription_id") REFERENCES "public"."membership_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_membership_subscription_id_idx" ON "bookings" USING btree ("membership_subscription_id");