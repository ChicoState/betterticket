import { buildApp } from "./app.js";
import { createDatabase } from "./database/client.js";
import { PostgresTicketRepository } from "./database/postgres-ticket-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the API");
}

const { database, close } = createDatabase(databaseUrl);
const app = buildApp({
  ticketRepository: new PostgresTicketRepository(database)
});

app.addHook("onClose", close);

await app.listen({
  host: "0.0.0.0",
  port: Number(process.env.PORT ?? 3000)
});
