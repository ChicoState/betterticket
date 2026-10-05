import { buildApp } from "./app.js";
import { PostgresAuthRepository } from "./database/postgres-auth-repository.js";
import { PostgresCommentRepository } from "./database/postgres-comment-repository.js";
import { PostgresNotificationRepository } from "./database/postgres-notification-repository.js";
import { hashPassword } from "./auth/password.js";
import { createDatabase } from "./database/client.js";
import { PostgresTicketRepository } from "./database/postgres-ticket-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the API");
}

const { database, close } = createDatabase(databaseUrl);
const authRepository = new PostgresAuthRepository(database);
const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (
  bootstrapEmail &&
  bootstrapPassword &&
  !(await authRepository.findUserByEmail(bootstrapEmail))
) {
  await authRepository.createUser({
    email: bootstrapEmail,
    passwordHash: await hashPassword(bootstrapPassword),
    role: "ADMIN"
  });
}

const app = buildApp({
  ticketRepository: new PostgresTicketRepository(database),
  commentRepository: new PostgresCommentRepository(database),
  authRepository,
  notificationRepository: new PostgresNotificationRepository(database)
});

app.addHook("onClose", close);

await app.listen({
  host: "0.0.0.0",
  port: Number(process.env.PORT ?? 3000)
});
