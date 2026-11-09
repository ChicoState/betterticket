CREATE TYPE "public"."reply_kind" AS ENUM('SOLUTION', 'COMMENT');--> statement-breakpoint
CREATE TABLE "reply_endorsements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reply_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reply_endorsements_reply_id_technician_id_unique" UNIQUE("reply_id","technician_id")
);
--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD COLUMN "kind" "reply_kind" DEFAULT 'COMMENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "reply_endorsements" ADD CONSTRAINT "reply_endorsements_reply_id_ticket_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."ticket_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply_endorsements" ADD CONSTRAINT "reply_endorsements_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reply_endorsements_reply_id_idx" ON "reply_endorsements" USING btree ("reply_id");