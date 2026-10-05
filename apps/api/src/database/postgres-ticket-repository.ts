import { desc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { tickets } from "./schema.js";
import type {
  CreateTicketInput,
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
}
