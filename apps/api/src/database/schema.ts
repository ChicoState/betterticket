import { pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

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
