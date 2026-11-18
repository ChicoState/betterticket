CREATE TABLE IF NOT EXISTS "ticket_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(127) NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_attachments_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_reply_votes" (
	"reply_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "ticket_reply_votes_value_check" CHECK ("ticket_reply_votes"."value" in (-1, 1))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_votes" (
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "ticket_votes_value_check" CHECK ("ticket_votes"."value" in (-1, 1))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_reply_votes" ADD CONSTRAINT "ticket_reply_votes_reply_id_ticket_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."ticket_replies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_reply_votes" ADD CONSTRAINT "ticket_reply_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_votes" ADD CONSTRAINT "ticket_votes_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_votes" ADD CONSTRAINT "ticket_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_attachments_ticket_id_created_at_idx" ON "ticket_attachments" USING btree ("ticket_id","created_at","id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_reply_votes_reply_user_idx" ON "ticket_reply_votes" USING btree ("reply_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_reply_votes_reply_id_idx" ON "ticket_reply_votes" USING btree ("reply_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_votes_ticket_user_idx" ON "ticket_votes" USING btree ("ticket_id","user_id");
