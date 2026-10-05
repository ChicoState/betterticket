CREATE TYPE "public"."user_role" AS ENUM('USER', 'IT_MEMBER', 'ADMIN');--> statement-breakpoint
ALTER TYPE "public"."ticket_status" ADD VALUE IF NOT EXISTS 'RESOLVED';--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL,
  "password_hash" text NOT NULL,
  "role" "user_role" DEFAULT 'USER' NOT NULL,
  "must_change_password" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" varchar(64) NOT NULL,
  "csrf_token" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "owner_id" uuid REFERENCES "users"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "solution_comment_id" uuid;--> statement-breakpoint
CREATE TABLE "comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "parent_comment_id" uuid,
  "body" text NOT NULL,
  "is_spotlighted" boolean DEFAULT false NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_solution_comment_id_comments_id_fk" FOREIGN KEY ("solution_comment_id") REFERENCES "comments"("id") ON DELETE set null;--> statement-breakpoint
CREATE TABLE "helpful_votes" (
  "comment_id" uuid NOT NULL REFERENCES "comments"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "helpful_votes_comment_id_user_id_pk" PRIMARY KEY("comment_id", "user_id")
);
--> statement-breakpoint
CREATE TYPE "public"."notification_event" AS ENUM('COMMENT', 'REPLY', 'HELPFUL', 'SOLUTION');--> statement-breakpoint
CREATE TABLE "notification_preferences" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
  "event" "notification_event" NOT NULL,
  "in_app_enabled" boolean DEFAULT true NOT NULL,
  "email_enabled" boolean DEFAULT false NOT NULL,
  CONSTRAINT "notification_preferences_user_id_ticket_id_event_pk" PRIMARY KEY("user_id", "ticket_id", "event")
);--> statement-breakpoint
CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE cascade,
  "comment_id" uuid REFERENCES "comments"("id") ON DELETE set null,
  "event" "notification_event" NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "email_pending" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
