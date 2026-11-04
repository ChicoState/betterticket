DO $$ BEGIN
  CREATE TYPE "public"."ticket_reply_status" AS ENUM('OPEN', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "replyStatus" "ticket_reply_status" DEFAULT 'OPEN' NOT NULL;
