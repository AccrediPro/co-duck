CREATE TABLE "session_note_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text,
	"name" text NOT NULL,
	"description" text,
	"sections" jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_notes" ADD COLUMN "template_id" integer;--> statement-breakpoint
ALTER TABLE "session_notes" ADD COLUMN "sections" jsonb;--> statement-breakpoint
ALTER TABLE "session_note_templates" ADD CONSTRAINT "session_note_templates_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_note_templates_coach_id_idx" ON "session_note_templates" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "session_note_templates_is_system_idx" ON "session_note_templates" USING btree ("is_system");--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_template_id_session_note_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."session_note_templates"("id") ON DELETE set null ON UPDATE no action;