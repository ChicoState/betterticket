import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { PostgresAuthRepository } from "./postgres-auth-repository.js";
import { sessions, users } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const { database, close } = createDatabase(databaseUrl);

describe("PostgresAuthRepository", () => {
  beforeEach(async () => {
    await database.delete(sessions);
    await database.delete(users);
  });

  afterAll(close);

  it("provisions a user with a password hash that can authenticate", async () => {
    const repository = new PostgresAuthRepository(database);

    const user = await repository.createUser({
      name: "Terry Technician",
      username: "  TERRY  ",
      password: "correct horse battery staple",
      role: "TECHNICIAN"
    });
    const [storedUser] = await database.select().from(users);
    const session = await repository.createSession({
      username: "terry",
      password: "correct horse battery staple"
    });
    const [storedSession] = await database.select().from(sessions);

    expect(user).toMatchObject({ name: "Terry Technician", username: "terry", role: "TECHNICIAN" });
    expect(storedUser?.passwordHash).not.toBe("correct horse battery staple");
    expect(storedUser?.passwordHash).toMatch(/^\$argon2id\$/u);
    expect(session?.user).toEqual(user);
    expect(session?.token).toHaveLength(43);
    expect(storedSession?.tokenHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(storedSession?.tokenHash).not.toBe(session?.token);
  });

  it("rejects incorrect credentials without creating a session", async () => {
    const repository = new PostgresAuthRepository(database);
    await repository.createUser({
      name: "Uma User",
      username: "uma",
      password: "correct horse battery staple",
      role: "USER"
    });

    const result = await repository.createSession({ username: "uma", password: "wrong password" });

    expect(result).toBeNull();
    expect(await database.select().from(sessions)).toHaveLength(0);
  });

  it("resolves and revokes a valid server-side session", async () => {
    const repository = new PostgresAuthRepository(database);
    const user = await repository.createUser({
      name: "Terry Technician",
      username: "terry",
      password: "correct horse battery staple",
      role: "TECHNICIAN"
    });
    const session = await repository.createSession({
      username: "terry",
      password: "correct horse battery staple"
    });

    expect(session).not.toBeNull();
    expect(await repository.findUserBySession(session!.token)).toEqual(user);

    await repository.deleteSession(session!.token);

    expect(await repository.findUserBySession(session!.token)).toBeNull();
  });

  it("rejects an expired server-side session", async () => {
    const repository = new PostgresAuthRepository(database);
    await repository.createUser({
      name: "Terry Technician",
      username: "terry",
      password: "correct horse battery staple",
      role: "TECHNICIAN"
    });
    const session = await repository.createSession({
      username: "terry",
      password: "correct horse battery staple"
    });

    expect(session).not.toBeNull();
    await database.update(sessions).set({ expiresAt: new Date(0) });

    expect(await repository.findUserBySession(session!.token)).toBeNull();
  });

  it("does not create duplicate normalized usernames", async () => {
    const repository = new PostgresAuthRepository(database);
    await repository.createUser({
      name: "First Terry",
      username: "terry",
      password: "correct horse battery staple",
      role: "TECHNICIAN"
    });

    const duplicate = await repository.createUser({
      name: "Second Terry",
      username: " TERRY ",
      password: "another correct horse battery staple",
      role: "USER"
    });

    expect(duplicate).toBeNull();
  });
});
