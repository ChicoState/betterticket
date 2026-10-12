ALTER TABLE "tickets" ADD COLUMN "creator_user_id" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;