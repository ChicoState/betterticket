import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { ticketReplies, tickets, users } from "./schema.js";
import type {
  AssignmentResult,
  CreateTicketInput,
  ReplyCreationResult,
  TicketCreator,
  ReplyRecord,
  TicketRecord,
  TicketRepository,
  UpdateReplyStatusResult
} from "../tickets/ticket-repository.js";
import type { TicketReplyStatus } from "../tickets/ticket-contract.js";

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

  async createReply(ticketId: string, body: string): Promise<ReplyCreationResult> {
    const [reply] = await this.database
      .insert(ticketReplies)
      .select(
        this.database
          .select({
            id: sql<string>`gen_random_uuid()`.as("id"),
            ticketId: tickets.id,
            body: sql<string>`${body}`.as("body"),
            createdAt: sql<Date>`now()`.as("created_at")
          })
          .from(tickets)
          .where(and(eq(tickets.id, ticketId), eq(tickets.replyStatus, "OPEN")))
      )
      .returning();

    if (reply) {
      return { type: "created", reply };
    }

    return (await this.findById(ticketId))
      ? { type: "ticket-closed" }
      : { type: "ticket-not-found" };
  }

  async listRecentReplies(ticketId: string, limit: number): Promise<ReplyRecord[]> {
    const newestFirst = await this.database
      .select()
      .from(ticketReplies)
      .where(eq(ticketReplies.ticketId, ticketId))
      .orderBy(desc(ticketReplies.createdAt), desc(ticketReplies.id))
      .limit(limit);

    return newestFirst.reverse();
  }

  async updateReplyStatus(
    ticketId: string,
    ownerUserId: string,
    replyStatus: TicketReplyStatus
  ): Promise<UpdateReplyStatusResult> {
    const [ticket] = await this.database
      .update(tickets)
      .set({ replyStatus, updatedAt: new Date() })
      .where(and(eq(tickets.id, ticketId), eq(tickets.creatorUserId, ownerUserId)))
      .returning({ id: tickets.id });

    if (ticket) {
      const updatedTicket = await this.findById(ticketId);
      if (!updatedTicket) {
        throw new Error("Ticket update could not be read");
      }
      return { type: "updated", ticket: updatedTicket };
    }

    return (await this.findById(ticketId)) ? { type: "not-owner" } : { type: "ticket-not-found" };
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
