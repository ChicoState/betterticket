import { createInterface } from "node:readline/promises";

import { createDatabase } from "../database/client.js";
import { PostgresAuthRepository } from "../database/postgres-auth-repository.js";
import { normalizeUsername, parseUserRole, type UserRole } from "./auth-contract.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to change a user's role");
}

async function readRoleChange(): Promise<{ username: string; role: UserRole }> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const username = normalizeUsername(await prompt.question("Username: "));
    if (!username) {
      throw new Error("Username is required");
    }
    const role = parseUserRole(await prompt.question("Role (USER or TECHNICIAN): "));

    return { username, role };
  } finally {
    prompt.close();
  }
}

const { username, role } = await readRoleChange();
const { database, close } = createDatabase(databaseUrl);

try {
  const user = await new PostgresAuthRepository(database).setUserRole(username, role);

  if (!user) {
    throw new Error("No user has that username");
  }

  process.stdout.write(`Updated ${user.username} to ${user.role}.\n`);
} finally {
  await close();
}
