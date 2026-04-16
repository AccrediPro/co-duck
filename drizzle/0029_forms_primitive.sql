-- Forms primitive (P0-08)
-- form_type enum, forms table, form_responses table

CREATE TYPE "public"."form_type" AS ENUM('intake', 'session_feedback', 'progress_check', 'custom');

CREATE TABLE "forms" (
  "id" serial PRIMARY KEY NOT NULL,
  "coach_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "form_type" "form_type" NOT NULL DEFAULT 'custom',
  "questions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_published" boolean NOT NULL DEFAULT false,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "form_responses" (
  "id" serial PRIMARY KEY NOT NULL,
  "form_id" integer NOT NULL,
  "respondent_id" text NOT NULL,
  "booking_id" integer,
  "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "submitted_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "forms" ADD CONSTRAINT "forms_coach_id_users_id_fk"
  FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_form_id_forms_id_fk"
  FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_respondent_id_users_id_fk"
  FOREIGN KEY ("respondent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_booking_id_bookings_id_fk"
  FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "forms_coach_id_idx" ON "forms" USING btree ("coach_id");
CREATE INDEX "forms_form_type_idx" ON "forms" USING btree ("form_type");
CREATE INDEX "form_responses_form_id_idx" ON "form_responses" USING btree ("form_id");
CREATE INDEX "form_responses_respondent_id_idx" ON "form_responses" USING btree ("respondent_id");
CREATE INDEX "form_responses_booking_id_idx" ON "form_responses" USING btree ("booking_id");
