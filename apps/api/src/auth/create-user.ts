import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";

import { createDatabase } from "../database/client.js";
import { PostgresAuthRepository } from "../database/postgres-auth-repository.js";
import { normalizeUsername, userRoles, type CreateUserInput } from "./auth-contract.js";

class PromptOutput extends Writable {
  muted = false;

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ) {
    if (!this.muted) {
      process.stdout.write(chunk, encoding);
    }
    callback();
  }
}

function validateInput(input: CreateUserInput): void {
  if (!input.name || input.name.length > 160) {
    throw new Error("Name must contain between 1 and 160 characters");
  }
  if (!/^[a-z0-9._-]{1,100}$/u.test(input.username)) {
    throw new Error(
      "Username may contain lowercase letters, numbers, periods, underscores, and hyphens"
    );
  }
  if (input.password.length < 12 || input.password.length > 128) {
    throw new Error("Password must contain between 12 and 128 characters");
  }
}

async function readUserInput(): Promise<CreateUserInput> {
  const output = new PromptOutput();
  const prompt = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });

  try {
    const name = (await prompt.question("Name: ")).trim();
    const username = normalizeUsername(await prompt.question("Username: "));

    process.stdout.write("Password: ");
    output.muted = true;
    const password = await prompt.question("");
    output.muted = false;
    process.stdout.write("\n");

    const roleInput = (await prompt.question("Role (USER or TECHNICIAN): ")).trim().toUpperCase();
    if (!userRoles.includes(roleInput as (typeof userRoles)[number])) {
      throw new Error("Role must be USER or TECHNICIAN");
    }

    const input: CreateUserInput = {
      name,
      username,
      password,
      role: roleInput as (typeof userRoles)[number]
    };
    validateInput(input);
    return input;
  } finally {
    output.muted = false;
    prompt.close();
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to create a user");
}

const { database, close } = createDatabase(databaseUrl);

try {
  const repository = new PostgresAuthRepository(database);
  const user = await repository.createUser(await readUserInput());

  if (!user) {
    throw new Error("That username already exists");
  }

  process.stdout.write(`Created ${user.role} user ${user.username}.\n`);
} finally {
  await close();
}
