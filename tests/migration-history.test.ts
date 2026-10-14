import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface MigrationJournal {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
}

const migrationsDirectory = resolve(import.meta.dirname, "../apps/api/drizzle");

describe("released migration history", () => {
  it("keeps the ticket replies migration immutable", () => {
    const journal = JSON.parse(
      readFileSync(resolve(migrationsDirectory, "meta/_journal.json"), "utf8")
    ) as MigrationJournal;
    const migration = readFileSync(resolve(migrationsDirectory, "0002_new_magneto.sql"));

    expect(journal.entries[2]).toMatchObject({
      idx: 2,
      tag: "0002_new_magneto",
      when: 1791497140595
    });
    expect(createHash("sha256").update(migration).digest("hex")).toBe(
      "576f9f39d6df52f443949a9396b2d53be696561b76926294e00e2a9c7bfd94e0"
    );
  });
});
