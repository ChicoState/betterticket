import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { comments, helpfulVotes } from "./schema.js";
import type { CommentRecord, CommentRepository } from "../tickets/comment-repository.js";

export class PostgresCommentRepository implements CommentRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async list(ticketId: string): Promise<CommentRecord[]> {
    return this.database
      .select()
      .from(comments)
      .where(eq(comments.ticketId, ticketId))
      .orderBy(comments.createdAt);
  }

  async findById(id: string): Promise<CommentRecord | null> {
    const [comment] = await this.database.select().from(comments).where(eq(comments.id, id));
    return comment ?? null;
  }

  async create(input: {
    ticketId: string;
    authorId: string;
    body: string;
    parentCommentId?: string;
  }): Promise<CommentRecord> {
    const [comment] = await this.database.insert(comments).values(input).returning();
    if (!comment) throw new Error("Comment insert did not return a row");
    return comment;
  }

  async update(id: string, body: string): Promise<CommentRecord | null> {
    const [comment] = await this.database
      .update(comments)
      .set({ body, updatedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();
    return comment ?? null;
  }

  async softDelete(id: string): Promise<CommentRecord | null> {
    const [comment] = await this.database
      .update(comments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();
    return comment ?? null;
  }

  async setSpotlight(id: string, isSpotlighted: boolean): Promise<CommentRecord | null> {
    const [comment] = await this.database
      .update(comments)
      .set({ isSpotlighted, updatedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();
    return comment ?? null;
  }

  async toggleHelpful(commentId: string, userId: string): Promise<boolean> {
    const [existing] = await this.database
      .select()
      .from(helpfulVotes)
      .where(and(eq(helpfulVotes.commentId, commentId), eq(helpfulVotes.userId, userId)));
    if (existing) {
      await this.database
        .delete(helpfulVotes)
        .where(and(eq(helpfulVotes.commentId, commentId), eq(helpfulVotes.userId, userId)));
      return false;
    }
    await this.database.insert(helpfulVotes).values({ commentId, userId }).onConflictDoNothing();
    return true;
  }

  async helpfulCount(commentId: string): Promise<number> {
    const [result] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(helpfulVotes)
      .where(eq(helpfulVotes.commentId, commentId));
    return result?.count ?? 0;
  }
}
