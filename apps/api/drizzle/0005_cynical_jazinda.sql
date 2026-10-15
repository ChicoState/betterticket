CREATE TYPE "public"."ticket_reply_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "replyStatus" "ticket_reply_status" DEFAULT 'OPEN' NOT NULL;