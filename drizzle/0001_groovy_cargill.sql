CREATE TABLE "coach_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"headline" text,
	"bio" text,
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"hourly_rate" integer,
	"currency" text DEFAULT 'USD',
	"timezone" text,
	"video_intro_url" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"profile_completion_percentage" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_profiles_slug_idx" ON "coach_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "coach_profiles_is_published_idx" ON "coach_profiles" USING btree ("is_published");