CREATE TABLE "availability_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"date" date NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL,
	"start_time" time,
	"end_time" time,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "buffer_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "advance_notice_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "max_advance_days" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_coach_id_coach_profiles_user_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coach_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_availability" ADD CONSTRAINT "coach_availability_coach_id_coach_profiles_user_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coach_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_overrides_coach_id_idx" ON "availability_overrides" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "availability_overrides_date_idx" ON "availability_overrides" USING btree ("date");--> statement-breakpoint
CREATE INDEX "availability_overrides_coach_date_idx" ON "availability_overrides" USING btree ("coach_id","date");--> statement-breakpoint
CREATE INDEX "coach_availability_coach_id_idx" ON "coach_availability" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_availability_day_of_week_idx" ON "coach_availability" USING btree ("day_of_week");