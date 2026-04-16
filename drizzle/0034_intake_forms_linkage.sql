-- Intake Forms Linkage (P0-09)
-- Links forms (P0-08) to coach session types + bookings so clients can be
-- required to complete an intake form before a booking is confirmed.

-- 1) Coach-level default intake form (optional)
ALTER TABLE "coach_profiles"
  ADD COLUMN "default_intake_form_id" integer;

ALTER TABLE "coach_profiles"
  ADD CONSTRAINT "coach_profiles_default_intake_form_id_forms_id_fk"
  FOREIGN KEY ("default_intake_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;

-- 2) Per-booking intake response link
ALTER TABLE "bookings"
  ADD COLUMN "intake_response_id" integer;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_intake_response_id_form_responses_id_fk"
  FOREIGN KEY ("intake_response_id") REFERENCES "public"."form_responses"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "bookings_intake_response_id_idx" ON "bookings" USING btree ("intake_response_id");

-- Note: per-session-type intake form IDs are stored inline inside the
-- existing `coach_profiles.session_types` JSONB column (no schema change).
