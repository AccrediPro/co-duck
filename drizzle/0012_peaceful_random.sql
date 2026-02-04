ALTER TABLE "bookings" ADD COLUMN "reminder_24h_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reminder_1h_sent_at" timestamp with time zone;