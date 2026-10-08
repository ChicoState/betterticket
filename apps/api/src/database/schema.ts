import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const ticketStatus = pgEnum("ticket_status", ["OPEN"]);

export const tickets = pgTable("tickets", {
  id: uuid().defaultRandom().primaryKey(),
  title: varchar({ length: 160 }).notNull(),
  description: text().notNull(),
  setup: text().notNull(),
  additionalInformation: text("additional_information"),
  status: ticketStatus().default("OPEN").notNull(),
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
