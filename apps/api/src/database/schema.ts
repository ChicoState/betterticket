import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const ticketStatus = pgEnum("ticket_status", [
  "OPEN",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "COMPLETED"
]);
export const ticketReplyStatus = pgEnum("ticket_reply_status", ["OPEN", "CLOSED"]);
export const userRole = pgEnum("user_role", ["USER", "TECHNICIAN"]);
export const ticketPriority = pgEnum("ticket_priority", ["LOW", "MEDIUM", "HIGH"]);
export const ticketVisibility = pgEnum("ticket_visibility", ["PUBLIC", "AUTHENTICATED", "PRIVATE"]);
export const replyKind = pgEnum("reply_kind", ["SOLUTION", "COMMENT"]);

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar({ length: 160 }).notNull(),
  username: varchar({ length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole().notNull()
});

export const sessions = pgTable("sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
});

export const tickets = pgTable("tickets", {
  id: uuid().defaultRandom().primaryKey(),
  title: varchar({ length: 160 }).notNull(),
  description: text().notNull(),
  setup: text().notNull(),
  additionalInformation: text("additional_information"),
  status: ticketStatus().default("OPEN").notNull(),
  replyStatus: ticketReplyStatus().default("OPEN").notNull(),
  priority: ticketPriority().default("MEDIUM").notNull(),
  visibility: ticketVisibility().default("PUBLIC").notNull(),
  creatorUserId: uuid("creator_user_id").references(() => users.id, { onDelete: "set null" }),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  assignedTechnicianId: uuid("assigned_technician_id").references(() => users.id, {
    onDelete: "set null"
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const ticketReplies = pgTable(
  "ticket_replies",
  {
    id: uuid().defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    kind: replyKind().default("COMMENT").notNull(),
    body: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("ticket_replies_ticket_id_created_at_idx").on(table.ticketId, table.createdAt)]
);

export const replyEndorsements = pgTable(
  "reply_endorsements",
  {
    id: uuid().defaultRandom().primaryKey(),
    replyId: uuid("reply_id")
      .notNull()
      .references(() => ticketReplies.id, { onDelete: "cascade" }),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notes: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    unique("reply_endorsements_reply_id_technician_id_unique").on(
      table.replyId,
      table.technicianId
    ),
    index("reply_endorsements_reply_id_idx").on(table.replyId)
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    previousStatus: ticketStatus("previous_status").notNull(),
    newStatus: ticketStatus("new_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    readAt: timestamp("read_at", { withTimezone: true })
  },
  (table) => [index("notifications_user_id_created_at_idx").on(table.userId, table.createdAt)]
);

export const notificationSettings = pgTable("notification_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  email: varchar({ length: 254 }),
  emailEnabled: boolean("email_enabled").default(false).notNull(),
  emailStatuses: ticketStatus("email_statuses").array().default(["RESOLVED"]).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const ticketReplyVotes = pgTable(
  "ticket_reply_votes",
  {
    replyId: uuid("reply_id")
      .notNull()
      .references(() => ticketReplies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: integer().notNull()
  },
  (table) => [
    uniqueIndex("ticket_reply_votes_reply_user_idx").on(table.replyId, table.userId),
    index("ticket_reply_votes_reply_id_idx").on(table.replyId),
    check("ticket_reply_votes_value_check", sql`${table.value} in (-1, 1)`)
  ]
);

export const ticketVotes = pgTable(
  "ticket_votes",
  {
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: integer().notNull()
  },
  (table) => [
    uniqueIndex("ticket_votes_ticket_user_idx").on(table.ticketId, table.userId),
    check("ticket_votes_value_check", sql`${table.value} in (-1, 1)`)
  ]
);
