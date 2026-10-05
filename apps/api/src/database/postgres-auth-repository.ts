import { and, eq, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { sessions, users } from "./schema.js";
import type { AuthRepository, AuthUser, Role, SessionRecord } from "../auth/auth-repository.js";

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const [user] = await this.database.select().from(users).where(eq(users.email, email));
    return user ?? null;
  }

  async createUser(input: { email: string; passwordHash: string; role: Role }): Promise<AuthUser> {
    const [user] = await this.database.insert(users).values(input).returning();
    if (!user) throw new Error("User insert did not return a row");
    return user;
  }

  async changePassword(userId: string, passwordHash: string): Promise<void> {
    await this.database
      .update(users)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(users.id, userId));
  }

  async createSession(input: {
    userId: string;
    tokenHash: string;
    csrfToken: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.insert(sessions).values(input);
  }

  async findSession(tokenHash: string): Promise<SessionRecord | null> {
    const [record] = await this.database
      .select({ user: users, csrfToken: sessions.csrfToken })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())));
    return record ?? null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.database.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }
}
