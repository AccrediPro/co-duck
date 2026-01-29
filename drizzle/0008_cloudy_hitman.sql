CREATE TABLE "session_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"coach_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_notes_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_notes_booking_id_idx" ON "session_notes" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "session_notes_coach_id_idx" ON "session_notes" USING btree ("coach_id");