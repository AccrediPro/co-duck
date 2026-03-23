CREATE TYPE "public"."check_in_mood" AS ENUM('good', 'okay', 'struggling');--> statement-breakpoint
CREATE TYPE "public"."streak_action_type" AS ENUM('session_completed', 'action_item_completed', 'iconnect_post', 'message_sent', 'check_in_completed', 'session_prep_completed');--> statement-breakpoint
CREATE TABLE "coaching_streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp with time zone,
	"week_starts_on" integer DEFAULT 1 NOT NULL,
	"streak_started_at" timestamp with time zone,
	"is_at_risk" boolean DEFAULT false NOT NULL,
	"notified_at_risk" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_prep_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"questions" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_prep_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"coach_id" text NOT NULL,
	"responses" jsonb NOT NULL,
	"prompted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"viewed_by_coach" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streak_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action_type" "streak_action_type" NOT NULL,
	"reference_id" text,
	"week_number" integer NOT NULL,
	"week_year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_check_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"coach_id" text NOT NULL,
	"mood" "check_in_mood" NOT NULL,
	"note" text,
	"week_number" integer NOT NULL,
	"week_year" integer NOT NULL,
	"check_in_day" integer DEFAULT 3 NOT NULL,
	"responded_at" timestamp with time zone,
	"prompted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coaching_streaks" ADD CONSTRAINT "coaching_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_prep_questions" ADD CONSTRAINT "session_prep_questions_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_prep_responses" ADD CONSTRAINT "session_prep_responses_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_prep_responses" ADD CONSTRAINT "session_prep_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_prep_responses" ADD CONSTRAINT "session_prep_responses_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_activities" ADD CONSTRAINT "streak_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_check_ins" ADD CONSTRAINT "weekly_check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_check_ins" ADD CONSTRAINT "weekly_check_ins_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coaching_streaks_user_id_idx" ON "coaching_streaks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_prep_questions_coach_id_idx" ON "session_prep_questions" USING btree ("coach_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_prep_responses_booking_id_idx" ON "session_prep_responses" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "session_prep_responses_coach_id_idx" ON "session_prep_responses" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "session_prep_responses_user_id_idx" ON "session_prep_responses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "streak_activities_user_id_idx" ON "streak_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "streak_activities_user_week_idx" ON "streak_activities" USING btree ("user_id","week_year","week_number");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_check_ins_user_coach_week_idx" ON "weekly_check_ins" USING btree ("user_id","coach_id","week_year","week_number");--> statement-breakpoint
CREATE INDEX "weekly_check_ins_coach_id_idx" ON "weekly_check_ins" USING btree ("coach_id");