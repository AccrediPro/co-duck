CREATE TYPE "public"."iconnect_post_type" AS ENUM('text', 'image', 'task');--> statement-breakpoint
CREATE TABLE "iconnect_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_user_id" text NOT NULL,
	"type" "iconnect_post_type" NOT NULL,
	"content" text,
	"image_url" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iconnect_task_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"label" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "iconnect_posts" ADD CONSTRAINT "iconnect_posts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iconnect_posts" ADD CONSTRAINT "iconnect_posts_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iconnect_task_items" ADD CONSTRAINT "iconnect_task_items_post_id_iconnect_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."iconnect_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iconnect_posts_conversation_id_idx" ON "iconnect_posts" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "iconnect_posts_sender_user_id_idx" ON "iconnect_posts" USING btree ("sender_user_id");--> statement-breakpoint
CREATE INDEX "iconnect_posts_created_at_idx" ON "iconnect_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "iconnect_task_items_post_id_idx" ON "iconnect_task_items" USING btree ("post_id");
