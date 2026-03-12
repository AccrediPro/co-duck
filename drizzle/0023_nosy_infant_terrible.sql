CREATE TABLE "client_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_group_members_group_client_unique" UNIQUE("group_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "client_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_groups_coach_name_unique" UNIQUE("coach_id","name")
);
--> statement-breakpoint
ALTER TABLE "client_group_members" ADD CONSTRAINT "client_group_members_group_id_client_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."client_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_group_members" ADD CONSTRAINT "client_group_members_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_groups" ADD CONSTRAINT "client_groups_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_group_members_group_id_idx" ON "client_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "client_group_members_client_id_idx" ON "client_group_members" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_groups_coach_id_idx" ON "client_groups" USING btree ("coach_id");