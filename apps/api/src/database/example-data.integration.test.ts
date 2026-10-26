import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { ExampleDataConflictError, exampleUsers, loadExampleData } from "./example-data.js";
import { PostgresAuthRepository } from "./postgres-auth-repository.js";
import {
  notificationSettings,
  notifications,
  sessions,
  ticketReplies,
  tickets,
  users
} from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const { database, close } = createDatabase(databaseUrl);

describe("example data", () => {
  beforeEach(async () => {
    await database.delete(notifications);
    await database.delete(ticketReplies);
    await database.delete(tickets);
    await database.delete(sessions);
    await database.delete(users);
  });

  afterAll(close);

  it("loads users who can log in alongside tickets, replies, notifications, and settings", async () => {
    await loadExampleData(database);

    const session = await new PostgresAuthRepository(database).createSession({
      username: "terry",
      password: "password"
    });

    expect(await database.select().from(users)).toHaveLength(exampleUsers.length);
    expect((await database.select().from(tickets)).length).toBeGreaterThan(0);
    expect((await database.select().from(ticketReplies)).length).toBeGreaterThan(0);
    expect((await database.select().from(notifications)).length).toBeGreaterThan(0);
    expect(await database.select().from(notificationSettings)).toEqual([
      expect.objectContaining({ email: "alice@example.com", emailEnabled: true })
    ]);
    expect(session?.user.role).toBe("TECHNICIAN");
  });

  it("refuses to load over existing data unless reset is requested", async () => {
    await loadExampleData(database);

    await expect(loadExampleData(database)).rejects.toBeInstanceOf(ExampleDataConflictError);
    await loadExampleData(database, { reset: true });
    expect(await database.select().from(users)).toHaveLength(exampleUsers.length);
  });
});
