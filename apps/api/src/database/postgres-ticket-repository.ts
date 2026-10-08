import { desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { ticketReplies, tickets } from "./schema.js";
import type {
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
}
