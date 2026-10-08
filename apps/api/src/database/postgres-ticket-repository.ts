import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { ticketReplies, tickets, users } from "./schema.js";
import type {
  AssignmentResult,
  CreateTicketInput,
  ReplyRecord,
  TicketRecord,
  TicketRepository
} from "../tickets/ticket-repository.js";

export class PostgresTicketRepository implements TicketRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async create(input: CreateTicketInput): Promise<TicketRecord> {
    const [ticket] = await this.database
      .insert(tickets)
      .values({
        title: input.title,
        description: input.description,
        setup: input.setup,
        additionalInformation: input.additionalInformation
      })
      .returning();

    if (!ticket) {
      throw new Error("Ticket insert did not return a row");
    }

    return ticket;
  }

  async listRecent(limit: number): Promise<TicketRecord[]> {
    return this.database
      .select()
      .from(tickets)
      .orderBy(desc(tickets.createdAt), desc(tickets.id))
      .limit(limit);
  }

  async findById(id: string): Promise<TicketRecord | null> {
    const [ticket] = await this.database.select().from(tickets).where(eq(tickets.id, id)).limit(1);

    return ticket ?? null;
  }

  async createReply(ticketId: string, body: string): Promise<ReplyRecord> {
    const [reply] = await this.database
      .insert(ticketReplies)
      .values({ ticketId, body })
      .returning();

    if (!reply) {
      throw new Error("Reply insert did not return a row");
    }

    return reply;
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

    return ticket ? { type: "updated", ticket } : { type: "ticket-not-found" };
  }
}
