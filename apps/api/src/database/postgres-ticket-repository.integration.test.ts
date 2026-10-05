import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { PostgresTicketRepository } from "./postgres-ticket-repository.js";
import { tickets, users } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const { database, close } = createDatabase(databaseUrl);

describe("PostgresTicketRepository", () => {
  beforeEach(async () => {
    await database.delete(tickets);
    await database.delete(users);
  });

  afterAll(close);

  it("persists and returns a ticket with database-generated fields", async () => {
    const repository = new PostgresTicketRepository(database);

    const [owner] = await database
      .insert(users)
      .values({
        email: "owner@example.com",
        passwordHash: "not-used-by-this-test"
      })
      .returning();
    if (!owner) throw new Error("Test user was not created");

    const created = await repository.create(
      {
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42"
      },
      owner.id
    );

    const storedTickets = await database.select().from(tickets);

    expect(storedTickets).toEqual([created]);
    expect(created).toMatchObject({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42",
      additionalInformation: null,
      ownerId: owner.id,
      solutionCommentId: null,
      status: "OPEN"
    });
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });
});
