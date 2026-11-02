CREATE TYPE "public"."ticket_visibility" AS ENUM('PUBLIC', 'AUTHENTICATED', 'PRIVATE');--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "visibility" "ticket_visibility" DEFAULT 'PUBLIC' NOT NULL;
