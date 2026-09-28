import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run database commands");
}

export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/database/schema.ts",
  dbCredentials: { url: databaseUrl }
});
