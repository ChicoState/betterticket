CREATE TABLE "ticket_reply_votes" (
	"reply_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "ticket_reply_votes_value_check" CHECK ("ticket_reply_votes"."value" in (-1, 1))
);
--> statement-breakpoint
ALTER TABLE "ticket_reply_votes" ADD CONSTRAINT "ticket_reply_votes_reply_id_ticket_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."ticket_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reply_votes" ADD CONSTRAINT "ticket_reply_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_reply_votes_reply_user_idx" ON "ticket_reply_votes" USING btree ("reply_id","user_id");--> statement-breakpoint
CREATE INDEX "ticket_reply_votes_reply_id_idx" ON "ticket_reply_votes" USING btree ("reply_id");