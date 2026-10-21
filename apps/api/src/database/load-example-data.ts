import { createDatabase } from "./client.js";
import { examplePassword, exampleUsers, loadExampleData } from "./example-data.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to load example data");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Example data must not be loaded in production");
}

const { database, close } = createDatabase(databaseUrl);

try {
  await loadExampleData(database, { reset: process.argv.includes("--reset") });

  const usernames = exampleUsers.map((user) => `${user.username} (${user.role})`).join(", ");
  process.stdout.write(
    `Loaded example data. Accounts: ${usernames}. Password for all: ${examplePassword}\n`
  );
} finally {
  await close();
}
