import { and, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { ticketReplies, ticketReplyVotes, ticketVotes, tickets, users } from "./schema.js";
import type {
  AssignmentResult,
  VoteValue,
  SetReplyVoteResult,
  SetTicketVoteResult,
  VoteState,
  CreateTicketInput,
  TicketCreator,
  ReplyRecord,
  StatusUpdateResult,
  TicketRecord,
  TicketRepository
} from "../tickets/ticket-repository.js";
import type { TicketStatus } from "../tickets/ticket-contract.js";

export class PostgresTicketRepository implements TicketRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async create(
    input: CreateTicketInput,
    creator: TicketCreator | null = null
  ): Promise<TicketRecord> {
    const [ticket] = await this.database
      .insert(tickets)
      .values({
        title: input.title,
        description: input.description,
        setup: input.setup,
        additionalInformation: input.additionalInformation,
        creatorUserId: creator?.id,
        isAnonymous: input.postAnonymously ?? false
      })
      .returning();

    if (!ticket) {
      throw new Error("Ticket insert did not return a row");
    }

    return {
      ...ticket,
      createdByName: input.postAnonymously ? null : (creator?.name ?? null)
    };
  }

  async listRecent(limit: number): Promise<TicketRecord[]> {
    const results = await this.database
      .select({ ...getTableColumns(tickets), creatorName: users.name })
      .from(tickets)
      .leftJoin(users, eq(tickets.creatorUserId, users.id))
      .orderBy(desc(tickets.createdAt), desc(tickets.id))
      .limit(limit);

    return results.map(toTicketRecord);
  }

  async findById(id: string): Promise<TicketRecord | null> {
    const [ticket] = await this.database
      .select({ ...getTableColumns(tickets), creatorName: users.name })
      .from(tickets)
      .leftJoin(users, eq(tickets.creatorUserId, users.id))
      .where(eq(tickets.id, id))
      .limit(1);

    return ticket ? toTicketRecord(ticket) : null;
  }

  async createReply(ticketId: string, body: string): Promise<ReplyRecord> {
    const [reply] = await this.database
      .insert(ticketReplies)
      .values({ ticketId, body })
      .returning();

    if (!reply) {
      throw new Error("Reply insert did not return a row");
    }

    return { ...reply, upvotes: 0, downvotes: 0, userVote: null };
  }

  async listRecentReplies(
    ticketId: string,
    limit: number,
    userId?: string
  ): Promise<ReplyRecord[]> {
    const newestFirst = await this.database
      .select({ ...getTableColumns(ticketReplies), ...replyVoteColumns(userId) })
      .from(ticketReplies)
      .where(eq(ticketReplies.ticketId, ticketId))
      .orderBy(desc(ticketReplies.createdAt), desc(ticketReplies.id))
      .limit(limit);

    return newestFirst.reverse();
  }

  async setReplyVote(
    ticketId: string,
    replyId: string,
    userId: string,
    value: VoteValue | null
  ): Promise<SetReplyVoteResult> {
    return this.database.transaction(async (transaction) => {
      // Serialize votes for this reply so the returned totals include the committed mutation.
      const [reply] = await transaction
        .select({ id: ticketReplies.id })
        .from(ticketReplies)
        .where(and(eq(ticketReplies.id, replyId), eq(ticketReplies.ticketId, ticketId)))
        .for("update");
      if (!reply) return { type: "reply-not-found" };
      if (value === null) {
        await transaction
          .delete(ticketReplyVotes)
          .where(and(eq(ticketReplyVotes.replyId, replyId), eq(ticketReplyVotes.userId, userId)));
      } else {
        await transaction
          .insert(ticketReplyVotes)
          .values({ replyId, userId, value })
          .onConflictDoUpdate({
            target: [ticketReplyVotes.replyId, ticketReplyVotes.userId],
            set: { value }
          });
      }
      const [vote] = await transaction
        .select(replyVoteColumns(userId))
        .from(ticketReplies)
        .where(eq(ticketReplies.id, replyId));
      if (!vote) throw new Error("Voted reply could not be read");
      return { type: "updated", vote };
    });
  }

  async listTicketVotes(
    ticketIds: string[],
    userId?: string
  ): Promise<Array<VoteState & { ticketId: string }>> {
    if (ticketIds.length === 0) return [];
    return this.database
      .select({ ticketId: tickets.id, ...ticketVoteColumns(userId) })
      .from(tickets)
      .where(inArray(tickets.id, ticketIds));
  }

  async getTicketVote(ticketId: string, userId?: string): Promise<VoteState | null> {
    const [vote] = await this.database
      .select(ticketVoteColumns(userId))
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    return vote ?? null;
  }

  async setTicketVote(
    ticketId: string,
    userId: string,
    value: VoteValue | null
  ): Promise<SetTicketVoteResult> {
    return this.database.transaction(async (transaction) => {
      const [ticket] = await transaction
        .select({ id: tickets.id })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .for("update");
      if (!ticket) return { type: "ticket-not-found" };
      if (value === null) {
        await transaction
          .delete(ticketVotes)
          .where(and(eq(ticketVotes.ticketId, ticketId), eq(ticketVotes.userId, userId)));
      } else {
        await transaction
          .insert(ticketVotes)
          .values({ ticketId, userId, value })
          .onConflictDoUpdate({
            target: [ticketVotes.ticketId, ticketVotes.userId],
            set: { value }
          });
      }
      const [vote] = await transaction
        .select(ticketVoteColumns(userId))
        .from(tickets)
        .where(eq(tickets.id, ticketId));
      if (!vote) throw new Error("Voted ticket could not be read");
      return { type: "updated", vote };
    });
  }

  async assignTechnician(
    ticketId: string,
    assignedTechnicianId: string | null
  ): Promise<AssignmentResult> {
    if (assignedTechnicianId) {
      const [technician] = await this.database
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, assignedTechnicianId), eq(users.role, "TECHNICIAN")));

      if (!technician) {
        return { type: "invalid-technician" };
      }
    }

    const [ticket] = await this.database
      .update(tickets)
      .set({ assignedTechnicianId, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
      .returning();

    if (!ticket) {
      return { type: "ticket-not-found" };
    }

    const updatedTicket = await this.findById(ticketId);
    if (!updatedTicket) {
      throw new Error("Ticket update could not be read");
    }

    return { type: "updated", ticket: updatedTicket };
  }

  async updateStatus(ticketId: string, status: TicketStatus): Promise<StatusUpdateResult> {
    return this.database.transaction(async (transaction) => {
      const readTicket = async (): Promise<TicketRecord | null> => {
        const [ticket] = await transaction
          .select({ ...getTableColumns(tickets), creatorName: users.name })
          .from(tickets)
          .leftJoin(users, eq(tickets.creatorUserId, users.id))
          .where(eq(tickets.id, ticketId))
          .limit(1);

        return ticket ? toTicketRecord(ticket) : null;
      };

      const [existing] = await transaction
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .for("update")
        .limit(1);

      if (!existing) {
        return { type: "ticket-not-found" };
      }
      if (existing.status === status) {
        const currentTicket = await readTicket();
        if (!currentTicket) {
          throw new Error("Ticket status update could not be read");
        }

        return { type: "unchanged", ticket: currentTicket };
      }
      if (!isAdjacentForwardTransition(existing.status, status)) {
        return { type: "invalid-transition" };
      }

      const [updated] = await transaction
        .update(tickets)
        .set({ status, updatedAt: new Date() })
        .where(eq(tickets.id, ticketId))
        .returning({ id: tickets.id });

      if (!updated) {
        throw new Error("Ticket status update did not return a row");
      }

      const updatedTicket = await readTicket();

      if (!updatedTicket) {
        throw new Error("Ticket status update could not be read");
      }

      return { type: "updated", ticket: updatedTicket };
    });
  }
}

function isAdjacentForwardTransition(current: TicketStatus, next: TicketStatus): boolean {
  return (
    (current === "OPEN" && next === "UNDER_REVIEW") ||
    (current === "UNDER_REVIEW" && next === "IN_PROGRESS") ||
    (current === "IN_PROGRESS" && next === "RESOLVED") ||
    (current === "RESOLVED" && next === "COMPLETED")
  );
}

function toTicketRecord(
  ticket: typeof tickets.$inferSelect & { creatorName: string | null }
): TicketRecord {
  const { creatorName, ...ticketRecord } = ticket;

  return {
    ...ticketRecord,
    createdByName: ticket.isAnonymous ? null : creatorName
  };
}

function replyVoteColumns(userId?: string) {
  return {
    upvotes:
      sql<number>`(select count(*) from ${ticketReplyVotes} where ${ticketReplyVotes.replyId} = ${ticketReplies.id} and ${ticketReplyVotes.value} = 1)`.mapWith(
        Number
      ),
    downvotes:
      sql<number>`(select count(*) from ${ticketReplyVotes} where ${ticketReplyVotes.replyId} = ${ticketReplies.id} and ${ticketReplyVotes.value} = -1)`.mapWith(
        Number
      ),
    userVote: userId
      ? sql<VoteValue | null>`(select ${ticketReplyVotes.value} from ${ticketReplyVotes} where ${ticketReplyVotes.replyId} = ${ticketReplies.id} and ${ticketReplyVotes.userId} = ${userId})`
      : sql<VoteValue | null>`null`
  };
}

function ticketVoteColumns(userId?: string) {
  return {
    upvotes:
      sql<number>`(select count(*) from ${ticketVotes} where ${ticketVotes.ticketId} = ${tickets.id} and ${ticketVotes.value} = 1)`.mapWith(
        Number
      ),
    downvotes:
      sql<number>`(select count(*) from ${ticketVotes} where ${ticketVotes.ticketId} = ${tickets.id} and ${ticketVotes.value} = -1)`.mapWith(
        Number
      ),
    userVote: userId
      ? sql<VoteValue | null>`(select ${ticketVotes.value} from ${ticketVotes} where ${ticketVotes.ticketId} = ${tickets.id} and ${ticketVotes.userId} = ${userId})`
      : sql<VoteValue | null>`null`
  };
}
