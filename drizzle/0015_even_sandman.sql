CREATE TYPE "public"."goal_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."group_participant_status" AS ENUM('registered', 'cancelled', 'attended', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."group_session_status" AS ENUM('draft', 'published', 'full', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_confirmed', 'booking_cancelled', 'session_completed', 'new_message', 'new_review', 'review_response', 'action_item', 'session_reminder', 'system');--> statement-breakpoint
CREATE TYPE "public"."program_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer,
	"goal_id" integer,
	"action_item_id" integer,
	"uploaded_by" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"coach_id" text NOT NULL,
	"client_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "goal_status" DEFAULT 'pending' NOT NULL,
	"priority" "goal_priority" DEFAULT 'medium' NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_session_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_session_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"status" "group_participant_status" DEFAULT 'registered' NOT NULL,
	"stripe_payment_intent_id" text,
	"amount_paid_cents" integer,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "group_participants_unique" UNIQUE("group_session_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "group_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"max_participants" integer DEFAULT 10 NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"duration" integer NOT NULL,
	"meeting_link" text,
	"status" "group_session_status" DEFAULT 'draft' NOT NULL,
	"tags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"client_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "program_status" DEFAULT 'active' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD COLUMN "goal_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_action_item_id_action_items_id_fk" FOREIGN KEY ("action_item_id") REFERENCES "public"."action_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_session_participants" ADD CONSTRAINT "group_session_participants_group_session_id_group_sessions_id_fk" FOREIGN KEY ("group_session_id") REFERENCES "public"."group_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_session_participants" ADD CONSTRAINT "group_session_participants_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_program_id_idx" ON "attachments" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "attachments_goal_id_idx" ON "attachments" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "attachments_action_item_id_idx" ON "attachments" USING btree ("action_item_id");--> statement-breakpoint
CREATE INDEX "attachments_uploaded_by_idx" ON "attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "goals_program_id_idx" ON "goals" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "goals_coach_id_idx" ON "goals" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "goals_client_id_idx" ON "goals" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "goals_status_idx" ON "goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "group_participants_session_idx" ON "group_session_participants" USING btree ("group_session_id");--> statement-breakpoint
CREATE INDEX "group_participants_client_idx" ON "group_session_participants" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "group_sessions_coach_id_idx" ON "group_sessions" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "group_sessions_status_idx" ON "group_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "group_sessions_start_time_idx" ON "group_sessions" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "programs_coach_id_idx" ON "programs" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "programs_client_id_idx" ON "programs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "programs_status_idx" ON "programs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "programs_coach_client_idx" ON "programs" USING btree ("coach_id","client_id");--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;