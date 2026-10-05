import { desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { tickets } from "./schema.js";
import type {
  CreateTicketInput,
  TicketRecord,
  TicketRepository
} from "../tickets/ticket-repository.js";

export class PostgresTicketRepository implements TicketRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async create(input: CreateTicketInput, ownerId: string): Promise<TicketRecord> {
    const [ticket] = await this.database
      .insert(tickets)
      .values({
        title: input.title,
        description: input.description,
        setup: input.setup,
        additionalInformation: input.additionalInformation,
        ownerId
      })
      .returning();

    if (!ticket) {
      throw new Error("Ticket insert did not return a row");
    }

    return ticket;
  }

  async list(): Promise<TicketRecord[]> {
    return this.database.select().from(tickets).orderBy(desc(tickets.createdAt));
  }

  async findById(id: string): Promise<TicketRecord | null> {
    const [ticket] = await this.database.select().from(tickets).where(eq(tickets.id, id));
    return ticket ?? null;
  }

  async setSolution(ticketId: string, commentId: string | null): Promise<TicketRecord | null> {
    const [ticket] = await this.database
      .update(tickets)
      .set({
        solutionCommentId: commentId,
        status: commentId === null ? "OPEN" : "RESOLVED",
        updatedAt: new Date()
      })
      .where(eq(tickets.id, ticketId))
      .returning();
    return ticket ?? null;
  }
}
