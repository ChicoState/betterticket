import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";

import { createDatabase } from "./client.js";
import { PostgresTicketRepository } from "./postgres-ticket-repository.js";
import { ticketStatuses } from "../tickets/ticket-contract.js";
import { sessions, ticketReplies, tickets, users } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const { database, close } = createDatabase(databaseUrl);

describe("PostgresTicketRepository", () => {
  beforeEach(async () => {
    await database.delete(ticketReplies);
    await database.delete(tickets);
    await database.delete(sessions);
    await database.delete(users);
  });

  afterAll(close);

  it("persists and returns a ticket with database-generated fields", async () => {
    const repository = new PostgresTicketRepository(database);

    const created = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });

    const storedTickets = await database.select().from(tickets);

    expect(storedTickets).toHaveLength(1);
    expect(created).toMatchObject({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42",
      additionalInformation: null,
      status: "OPEN",
      visibility: "PUBLIC",
      assignedTechnicianId: null
    });
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });

  it("lists the most recently created tickets first up to the limit", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = (title: string, createdAt: string) => ({
      title,
      description: "Description",
      setup: "Setup",
      createdAt: new Date(createdAt),
      updatedAt: new Date(createdAt)
    });
    await database
      .insert(tickets)
      .values([
        ticket("Oldest", "2026-09-27T12:00:00.000Z"),
        ticket("Newest", "2026-09-29T12:00:00.000Z"),
        ticket("Middle", "2026-09-28T12:00:00.000Z")
      ]);

    const listed = await repository.listRecent(2);

    expect(listed.map((listedTicket) => listedTicket.title)).toEqual(["Newest", "Middle"]);
  });

  it("filters tickets by visibility for anonymous users, owners, and technicians", async () => {
    const [owner, otherUser, technician] = await database
      .insert(users)
      .values([
        {
          name: "Ticket Owner",
          username: "ticket.owner",
          passwordHash: "not-used",
          role: "USER"
        },
        {
          name: "Other User",
          username: "other.user",
          passwordHash: "not-used",
          role: "USER"
        },
        {
          name: "IT Technician",
          username: "it.technician",
          passwordHash: "not-used",
          role: "TECHNICIAN"
        }
      ])
      .returning();
    const repository = new PostgresTicketRepository(database);
    const input = { description: "Description", setup: "Setup" };

    await repository.create({ ...input, title: "Public", visibility: "PUBLIC" });
    await repository.create(
      { ...input, title: "Authenticated", visibility: "AUTHENTICATED" },
      owner!
    );
    await repository.create({ ...input, title: "Private owner", visibility: "PRIVATE" }, owner!);
    await repository.create(
      { ...input, title: "Private other", visibility: "PRIVATE" },
      otherUser!
    );

    const titles = async (viewer: { id: string; role: "USER" | "TECHNICIAN" } | null) =>
      (await repository.listRecent(10, viewer)).map((ticket) => ticket.title).sort();

    expect(await titles(null)).toEqual(["Public"]);
    expect(await titles({ id: otherUser!.id, role: "USER" })).toEqual([
      "Authenticated",
      "Private other",
      "Public"
    ]);
    expect(await titles({ id: technician!.id, role: "TECHNICIAN" })).toEqual([
      "Authenticated",
      "Private other",
      "Private owner",
      "Public"
    ]);
  });

  it("persists and returns every approved ticket status", async () => {
    await database.insert(tickets).values(
      ticketStatuses.map((status, index) => ({
        title: status,
        description: "Description",
        setup: "Setup",
        status,
        createdAt: new Date(`2026-09-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
        updatedAt: new Date(`2026-09-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`)
      }))
    );

    const storedStatuses = await database
      .select({ status: tickets.status })
      .from(tickets)
      .orderBy(asc(tickets.createdAt));

    expect(storedStatuses.map((ticket) => ticket.status)).toEqual(ticketStatuses);
  });

  it("advances through every adjacent status and updates the timestamp", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });
    const initialUpdatedAt = new Date("2026-09-01T12:00:00.000Z");
    await database
      .update(tickets)
      .set({ updatedAt: initialUpdatedAt })
      .where(eq(tickets.id, ticket.id));

    for (const status of ticketStatuses.slice(1)) {
      const result = await repository.updateStatus(ticket.id, status);

      expect(result).toMatchObject({ type: "updated", ticket: { status } });
      if (result.type !== "updated") {
        throw new Error("Expected a successful status update");
      }
    }

    const finalTicket = await repository.findById(ticket.id);
    expect(finalTicket?.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
  });

  it("rejects skipped, backward, and terminal transitions", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });

    expect(await repository.updateStatus(ticket.id, "IN_PROGRESS")).toEqual({
      type: "invalid-transition"
    });
    expect(await repository.updateStatus(ticket.id, "UNDER_REVIEW")).toMatchObject({
      type: "updated",
      ticket: { status: "UNDER_REVIEW" }
    });
    expect(await repository.updateStatus(ticket.id, "OPEN")).toEqual({
      type: "invalid-transition"
    });

    for (const status of ["IN_PROGRESS", "RESOLVED", "COMPLETED"] as const) {
      expect(await repository.updateStatus(ticket.id, status)).toMatchObject({
        type: "updated",
        ticket: { status }
      });
    }

    expect(await repository.updateStatus(ticket.id, "COMPLETED")).toMatchObject({
      type: "unchanged",
      ticket: { status: "COMPLETED" }
    });
    expect(await repository.updateStatus(ticket.id, "RESOLVED")).toEqual({
      type: "invalid-transition"
    });
  });

  it("treats the current status as idempotent without changing updatedAt", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });
    const updatedAt = new Date("2026-09-01T12:00:00.000Z");
    await database
      .update(tickets)
      .set({ status: "IN_PROGRESS", updatedAt })
      .where(eq(tickets.id, ticket.id));

    const result = await repository.updateStatus(ticket.id, "IN_PROGRESS");

    expect(result).toMatchObject({ type: "unchanged", ticket: { status: "IN_PROGRESS" } });
    if (result.type !== "unchanged") {
      throw new Error("Expected an unchanged status update");
    }
    expect(result.ticket.updatedAt).toEqual(updatedAt);
  });

  it("reports an unknown ticket when updating status", async () => {
    const repository = new PostgresTicketRepository(database);

    expect(
      await repository.updateStatus("00000000-0000-4000-8000-000000000000", "UNDER_REVIEW")
    ).toEqual({ type: "ticket-not-found" });
  });

  it("finds a ticket by ID and returns null for an unknown ID", async () => {
    const repository = new PostgresTicketRepository(database);
    const created = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });

    expect(await repository.findById(created.id)).toEqual(created);
    expect(await repository.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("returns an attributed creator name unless the ticket was posted anonymously", async () => {
    const [user] = await database
      .insert(users)
      .values({
        name: "Uma User",
        username: "uma",
        passwordHash: "not-used",
        role: "USER"
      })
      .returning();
    const repository = new PostgresTicketRepository(database);
    const input = {
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    };

    const attributed = await repository.create(input, user!);
    const anonymous = await repository.create({ ...input, postAnonymously: true }, user!);
    const storedTickets = await database.select().from(tickets);

    expect(attributed.createdByName).toBe("Uma User");
    expect((await repository.findById(attributed.id))?.createdByName).toBe("Uma User");
    expect(anonymous.createdByName).toBeNull();
    expect((await repository.findById(anonymous.id))?.createdByName).toBeNull();
    expect(storedTickets.map((ticket) => ticket.creatorUserId)).toEqual([user!.id, user!.id]);
  });

  it("persists a reply and lists a ticket's most recent replies oldest first", async () => {
    const repository = new PostgresTicketRepository(database);
    const input = { title: "Title", description: "Description", setup: "Setup" };
    const ticket = await repository.create(input);
    const otherTicket = await repository.create(input);
    await database.insert(ticketReplies).values([
      { ticketId: ticket.id, body: "Second", createdAt: new Date("2026-09-28T12:00:00.000Z") },
      { ticketId: ticket.id, body: "First", createdAt: new Date("2026-09-27T12:00:00.000Z") },
      { ticketId: otherTicket.id, body: "Elsewhere" }
    ]);

    const created = await repository.createReply(ticket.id, "Third");

    expect(created).toMatchObject({ ticketId: ticket.id, body: "Third" });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect((await repository.listRecentReplies(ticket.id, 10)).map((reply) => reply.body)).toEqual([
      "First",
      "Second",
      "Third"
    ]);
    expect((await repository.listRecentReplies(ticket.id, 2)).map((reply) => reply.body)).toEqual([
      "Second",
      "Third"
    ]);
  });

  it("rejects a reply to a ticket that does not exist", async () => {
    const repository = new PostgresTicketRepository(database);

    await expect(
      repository.createReply("00000000-0000-4000-8000-000000000000", "Orphan")
    ).rejects.toThrow();
  });

  it("assigns, reassigns, and unassigns technicians without changing status", async () => {
    const [firstTechnician, secondTechnician] = await database
      .insert(users)
      .values([
        {
          name: "First Technician",
          username: "first.tech",
          passwordHash: "not-used",
          role: "TECHNICIAN"
        },
        {
          name: "Second Technician",
          username: "second.tech",
          passwordHash: "not-used",
          role: "TECHNICIAN"
        }
      ])
      .returning();
    const repository = new PostgresTicketRepository(database);
    const created = await repository.create(
      {
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42"
      },
      firstTechnician!
    );

    const assigned = await repository.assignTechnician(created.id, firstTechnician!.id);
    const reassigned = await repository.assignTechnician(created.id, secondTechnician!.id);
    const unassigned = await repository.assignTechnician(created.id, null);

    expect(assigned).toMatchObject({
      type: "updated",
      ticket: { assignedTechnicianId: firstTechnician!.id, status: "OPEN" }
    });
    expect(reassigned).toMatchObject({
      type: "updated",
      ticket: { assignedTechnicianId: secondTechnician!.id, status: "OPEN" }
    });
    expect(unassigned).toMatchObject({
      type: "updated",
      ticket: {
        assignedTechnicianId: null,
        createdByName: "First Technician",
        status: "OPEN"
      }
    });
  });

  it("rejects assignment to a regular user", async () => {
    const [regularUser] = await database
      .insert(users)
      .values({
        name: "Uma User",
        username: "uma",
        passwordHash: "not-used",
        role: "USER"
      })
      .returning();
    const repository = new PostgresTicketRepository(database);
    const created = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });

    const result = await repository.assignTechnician(created.id, regularUser!.id);

    expect(result).toEqual({ type: "invalid-technician" });
  });

  it("reports an unknown ticket", async () => {
    const repository = new PostgresTicketRepository(database);

    const result = await repository.assignTechnician("cc04d84c-9aee-4d35-8af3-999d861aaed6", null);

    expect(result).toEqual({ type: "ticket-not-found" });
  });
});
