import { createHash, randomBytes } from "node:crypto";

import { argon2id, hash, verify } from "argon2";
import { and, eq, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { normalizeUsername, type AuthenticatedUser } from "../auth/auth-contract.js";
import type { AuthRepository, CreatedSession } from "../auth/auth-repository.js";
import type { CreateUserInput, LoginInput } from "../auth/auth-contract.js";
import { sessions, users } from "./schema.js";

const sessionLifetimeMilliseconds = 24 * 60 * 60 * 1_000;
const dummyPasswordHash = hash("BetterTicket dummy authentication password", { type: argon2id });

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function withoutPassword(user: typeof users.$inferSelect): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role
  };
}

function isDuplicateUsernameViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;

  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === "users_username_unique"
  );
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async createSession(input: LoginInput): Promise<CreatedSession | null> {
    const username = normalizeUsername(input.username);
    const [user] = await this.database.select().from(users).where(eq(users.username, username));
    const passwordMatches = await verify(
      user?.passwordHash ?? (await dummyPasswordHash),
      input.password
    );

    if (!user || !passwordMatches) {
      return null;
    }

    const token = randomBytes(32).toString("base64url");
    await this.database.insert(sessions).values({
      tokenHash: hashSessionToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + sessionLifetimeMilliseconds)
    });

    return { token, user: withoutPassword(user) };
  }

  async findUserBySession(token: string): Promise<AuthenticatedUser | null> {
    const [user] = await this.database
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        role: users.role
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(eq(sessions.tokenHash, hashSessionToken(token)), gt(sessions.expiresAt, new Date()))
      );

    return user ?? null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.database.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
  }

  async createUser(input: CreateUserInput): Promise<AuthenticatedUser | null> {
    const username = normalizeUsername(input.username);

    try {
      const [user] = await this.database
        .insert(users)
        .values({
          name: input.name.trim(),
          username,
          passwordHash: await hash(input.password, { type: argon2id }),
          role: input.role
        })
        .returning();

      if (!user) {
        throw new Error("User insert did not return a row");
      }

      return withoutPassword(user);
    } catch (error) {
      if (isDuplicateUsernameViolation(error)) {
        return null;
      }
      throw error;
    }
  }
}
