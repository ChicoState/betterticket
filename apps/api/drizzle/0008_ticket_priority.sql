CREATE TYPE "public"."ticket_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "priority" "ticket_priority" DEFAULT 'MEDIUM' NOT NULL;