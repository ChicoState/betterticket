import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
export const userRole = pgEnum("user_role", ["USER", "TECHNICIAN"]);

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
    body: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("ticket_replies_ticket_id_created_at_idx").on(table.ticketId, table.createdAt)]
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
