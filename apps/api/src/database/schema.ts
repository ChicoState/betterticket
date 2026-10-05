import {
  boolean,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const ticketStatus = pgEnum("ticket_status", ["OPEN", "RESOLVED"]);
export const userRole = pgEnum("user_role", ["USER", "IT_MEMBER", "ADMIN"]);

export const users = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey(),
    email: varchar({ length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole().default("USER").notNull(),
    mustChangePassword: boolean("must_change_password").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    csrfToken: varchar("csrf_token", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash)]
);

export const tickets = pgTable("tickets", {
  id: uuid().defaultRandom().primaryKey(),
  title: varchar({ length: 160 }).notNull(),
  description: text().notNull(),
  setup: text().notNull(),
  additionalInformation: text("additional_information"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  solutionCommentId: uuid("solution_comment_id"),
  status: ticketStatus().default("OPEN").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const comments = pgTable("comments", {
  id: uuid().defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  parentCommentId: uuid("parent_comment_id"),
  body: text().notNull(),
  isSpotlighted: boolean("is_spotlighted").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const helpfulVotes = pgTable(
  "helpful_votes",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [primaryKey({ columns: [table.commentId, table.userId] })]
);

export const notificationEvent = pgEnum("notification_event", [
  "COMMENT",
  "REPLY",
  "HELPFUL",
  "SOLUTION"
]);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    event: notificationEvent().notNull(),
    inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
    emailEnabled: boolean("email_enabled").default(false).notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.ticketId, table.event] })]
);

export const notifications = pgTable("notifications", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  commentId: uuid("comment_id").references(() => comments.id, { onDelete: "set null" }),
  event: notificationEvent().notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  emailPending: boolean("email_pending").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
