import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { PostgresTicketRepository } from "./postgres-ticket-repository.js";
import { sessions, ticketReplies, tickets, users } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const { database, close } = createDatabase(databaseUrl);

describe("PostgresTicketRepository", () => {
  beforeEach(async () => {
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

    expect(storedTickets).toEqual([created]);
    expect(created).toMatchObject({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42",
      additionalInformation: null,
      status: "OPEN",
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
    const created = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });

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
      ticket: { assignedTechnicianId: null, status: "OPEN" }
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
