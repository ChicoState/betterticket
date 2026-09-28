import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export function createDatabase(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    database: drizzle(pool),
    close: () => pool.end()
  };
}
