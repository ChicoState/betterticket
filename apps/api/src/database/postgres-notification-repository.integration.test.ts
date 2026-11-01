import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabase } from "./client.js";
import { PostgresNotificationRepository } from "./postgres-notification-repository.js";
import { PostgresTicketRepository } from "./postgres-ticket-repository.js";
import { notifications, sessions, ticketReplies, tickets, users } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const { database, close } = createDatabase(databaseUrl);
const ticketRepository = new PostgresTicketRepository(database);
const notificationRepository = new PostgresNotificationRepository(database);

const ticketInput = {
  title: "Printer offline",
  description: "The printer does not respond.",
  setup: "Library printer"
};

async function insertUser(username: string, role: "USER" | "TECHNICIAN" = "USER") {
  const [user] = await database
    .insert(users)
    .values({ name: username, username, passwordHash: "not-used", role })
    .returning();

  if (!user) {
    throw new Error("User insert did not return a row");
  }

  return user;
}

describe("ticket status notifications", () => {
  beforeEach(async () => {
    await database.delete(notifications);
    await database.delete(ticketReplies);
    await database.delete(tickets);
    await database.delete(sessions);
    await database.delete(users);
  });

  afterAll(close);

  it("advances the status and notifies the ticket's creator", async () => {
    const owner = await insertUser("owner");
    const technician = await insertUser("tech", "TECHNICIAN");
    const ticket = await ticketRepository.create(ticketInput, owner);

    const result = await ticketRepository.updateStatus(ticket.id, "UNDER_REVIEW", technician.id);
    const listed = await notificationRepository.listRecent(owner.id, 20);

    expect(result).toMatchObject({ type: "updated", ticket: { status: "UNDER_REVIEW" } });
    expect(result.type === "updated" && result.ticket.updatedAt > ticket.updatedAt).toBe(true);
    expect(listed).toEqual({
      notifications: [
        expect.objectContaining({
          ticketId: ticket.id,
          ticketTitle: "Printer offline",
          previousStatus: "OPEN",
          newStatus: "UNDER_REVIEW",
          readAt: null
        })
      ],
      unreadCount: 1
    });
  });

  it("privately notifies the creator of an anonymous post", async () => {
    const owner = await insertUser("owner");
    const technician = await insertUser("tech", "TECHNICIAN");
    const ticket = await ticketRepository.create({ ...ticketInput, postAnonymously: true }, owner);

    await ticketRepository.updateStatus(ticket.id, "UNDER_REVIEW", technician.id);

    expect((await notificationRepository.listRecent(owner.id, 20)).unreadCount).toBe(1);
  });

  it("does not notify for unsigned tickets or when the creator makes the change", async () => {
    const technician = await insertUser("tech", "TECHNICIAN");
    const unsigned = await ticketRepository.create(ticketInput);
    const ownTicket = await ticketRepository.create(ticketInput, technician);

    await ticketRepository.updateStatus(unsigned.id, "UNDER_REVIEW", technician.id);
    await ticketRepository.updateStatus(ownTicket.id, "UNDER_REVIEW", technician.id);

    expect(await database.select().from(notifications)).toEqual([]);
  });

  it.each([
    ["skipped", "OPEN", "IN_PROGRESS"],
    ["backward", "IN_PROGRESS", "UNDER_REVIEW"],
    ["completion", "RESOLVED", "COMPLETED"]
  ] as const)("rejects a %s change without notifying", async (_name, from, to) => {
    const owner = await insertUser("owner");
    const technician = await insertUser("tech", "TECHNICIAN");
    const ticket = await ticketRepository.create(ticketInput, owner);
    await database.update(tickets).set({ status: from }).where(eq(tickets.id, ticket.id));

    const result = await ticketRepository.updateStatus(ticket.id, to, technician.id);

    expect(result).toEqual({ type: "invalid-transition" });
    expect((await ticketRepository.findById(ticket.id))?.status).toBe(from);
    expect(await database.select().from(notifications)).toEqual([]);
  });

  it("returns an unchanged ticket for the current status without notifying", async () => {
    const owner = await insertUser("owner");
    const technician = await insertUser("tech", "TECHNICIAN");
    const ticket = await ticketRepository.create(ticketInput, owner);
    await database.update(tickets).set({ status: "IN_PROGRESS" }).where(eq(tickets.id, ticket.id));

    const result = await ticketRepository.updateStatus(ticket.id, "IN_PROGRESS", technician.id);

    expect(result).toMatchObject({ type: "unchanged", ticket: { status: "IN_PROGRESS" } });
    expect(await database.select().from(notifications)).toEqual([]);
  });

  it("reports an unknown ticket", async () => {
    const technician = await insertUser("tech", "TECHNICIAN");

    const result = await ticketRepository.updateStatus(
      "cc04d84c-9aee-4d35-8af3-999d861aaed6",
      "UNDER_REVIEW",
      technician.id
    );

    expect(result).toEqual({ type: "ticket-not-found" });
  });

  it("lists newest first, limits results, and isolates users", async () => {
    const owner = await insertUser("owner");
    const otherOwner = await insertUser("other");
    const technician = await insertUser("tech", "TECHNICIAN");
    const ticket = await ticketRepository.create(ticketInput, owner);
    const otherTicket = await ticketRepository.create(ticketInput, otherOwner);

    await ticketRepository.updateStatus(ticket.id, "UNDER_REVIEW", technician.id);
    await ticketRepository.updateStatus(ticket.id, "IN_PROGRESS", technician.id);
    await ticketRepository.updateStatus(otherTicket.id, "UNDER_REVIEW", technician.id);

    const listed = await notificationRepository.listRecent(owner.id, 1);

    expect(listed.unreadCount).toBe(2);
    expect(listed.notifications.map((notification) => notification.newStatus)).toEqual([
      "IN_PROGRESS"
    ]);
  });

  it("marks only the user's own notifications as read", async () => {
    const owner = await insertUser("owner");
    const otherOwner = await insertUser("other");
    const technician = await insertUser("tech", "TECHNICIAN");
    const ticket = await ticketRepository.create(ticketInput, owner);
    const otherTicket = await ticketRepository.create(ticketInput, otherOwner);
    await ticketRepository.updateStatus(ticket.id, "UNDER_REVIEW", technician.id);
    await ticketRepository.updateStatus(otherTicket.id, "UNDER_REVIEW", technician.id);

    await notificationRepository.markAllRead(owner.id);

    const ownList = await notificationRepository.listRecent(owner.id, 20);
    expect(ownList.unreadCount).toBe(0);
    expect(ownList.notifications[0]?.readAt).toBeInstanceOf(Date);
    expect((await notificationRepository.listRecent(otherOwner.id, 20)).unreadCount).toBe(1);
  });

  it("removes notifications with their ticket or recipient", async () => {
    const owner = await insertUser("owner");
    const technician = await insertUser("tech", "TECHNICIAN");
    const firstTicket = await ticketRepository.create(ticketInput, owner);
    const secondTicket = await ticketRepository.create(ticketInput, owner);
    await ticketRepository.updateStatus(firstTicket.id, "UNDER_REVIEW", technician.id);
    await ticketRepository.updateStatus(secondTicket.id, "UNDER_REVIEW", technician.id);

    await database.delete(tickets).where(eq(tickets.id, firstTicket.id));
    expect(await database.select().from(notifications)).toHaveLength(1);

    await database.delete(users).where(eq(users.id, owner.id));
    expect(await database.select().from(notifications)).toEqual([]);
  });
});
