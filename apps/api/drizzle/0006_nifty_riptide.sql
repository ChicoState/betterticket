CREATE TABLE "ticket_votes" (
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "ticket_votes_value_check" CHECK ("ticket_votes"."value" in (-1, 1))
);
--> statement-breakpoint
ALTER TABLE "ticket_votes" ADD CONSTRAINT "ticket_votes_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_votes" ADD CONSTRAINT "ticket_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_votes_ticket_user_idx" ON "ticket_votes" USING btree ("ticket_id","user_id");