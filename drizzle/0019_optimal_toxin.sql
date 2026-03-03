CREATE TABLE "iconnect_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"sender_user_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iconnect_comments" ADD CONSTRAINT "iconnect_comments_post_id_iconnect_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."iconnect_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iconnect_comments" ADD CONSTRAINT "iconnect_comments_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iconnect_comments_post_id_idx" ON "iconnect_comments" USING btree ("post_id");