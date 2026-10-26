import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabase } from "./client.js";
import { PostgresSettingsRepository } from "./postgres-settings-repository.js";
import { notificationSettings, users } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const { database, close } = createDatabase(databaseUrl);
const settingsRepository = new PostgresSettingsRepository(database);

async function insertUser(username: string) {
  const [user] = await database
    .insert(users)
    .values({ name: username, username, passwordHash: "not-used", role: "USER" })
    .returning();

  if (!user) {
    throw new Error("User insert did not return a row");
  }

  return user;
}

describe("PostgresSettingsRepository", () => {
  beforeEach(async () => {
    await database.delete(notificationSettings);
    await database.delete(users);
  });

  afterAll(close);

  it("returns null before a user saves settings", async () => {
    const user = await insertUser("owner");

    expect(await settingsRepository.findNotificationSettings(user.id)).toBeNull();
  });

  it("creates and then replaces a user's settings", async () => {
    const user = await insertUser("owner");

    await settingsRepository.saveNotificationSettings(user.id, {
      email: "owner@example.com",
      emailEnabled: true,
      emailStatuses: ["UNDER_REVIEW", "RESOLVED"]
    });
    const saved = await settingsRepository.saveNotificationSettings(user.id, {
      email: null,
      emailEnabled: false,
      emailStatuses: ["IN_PROGRESS"]
    });

    expect(saved).toEqual({ email: null, emailEnabled: false, emailStatuses: ["IN_PROGRESS"] });
    expect(await settingsRepository.findNotificationSettings(user.id)).toEqual(saved);
  });

  it("keeps each user's settings separate", async () => {
    const owner = await insertUser("owner");
    const other = await insertUser("other");

    await settingsRepository.saveNotificationSettings(owner.id, {
      email: "owner@example.com",
      emailEnabled: true,
      emailStatuses: ["RESOLVED"]
    });

    expect(await settingsRepository.findNotificationSettings(other.id)).toBeNull();
  });

  it("deletes settings with their user", async () => {
    const user = await insertUser("owner");
    await settingsRepository.saveNotificationSettings(user.id, {
      email: "owner@example.com",
      emailEnabled: true,
      emailStatuses: ["RESOLVED"]
    });

    await database.delete(users).where(eq(users.id, user.id));

    expect(await database.select().from(notificationSettings)).toEqual([]);
  });
});
