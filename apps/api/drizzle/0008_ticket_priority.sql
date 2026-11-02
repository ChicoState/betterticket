DO $$ BEGIN
  CREATE TYPE "public"."ticket_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "priority" "ticket_priority" DEFAULT 'MEDIUM' NOT NULL;
