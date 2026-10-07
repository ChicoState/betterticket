import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { PostgresTicketRepository } from "./postgres-ticket-repository.js";
import { tickets } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const { database, close } = createDatabase(databaseUrl);

describe("PostgresTicketRepository", () => {
  beforeEach(async () => {
    await database.delete(tickets);
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
      status: "OPEN"
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
});
