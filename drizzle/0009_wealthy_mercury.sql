CREATE TABLE "action_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"client_id" text NOT NULL,
	"booking_id" integer,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_coach_id_idx" ON "action_items" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "action_items_client_id_idx" ON "action_items" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "action_items_is_completed_idx" ON "action_items" USING btree ("is_completed");