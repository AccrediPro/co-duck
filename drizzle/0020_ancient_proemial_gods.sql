CREATE TYPE "public"."coach_invite_status" AS ENUM('pending', 'claimed');--> statement-breakpoint
CREATE TABLE "coach_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" "coach_invite_status" DEFAULT 'pending' NOT NULL,
	"invited_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "coach_invites_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "coach_invites" ADD CONSTRAINT "coach_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;