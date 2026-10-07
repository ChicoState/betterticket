import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { tickets, users } from "./schema.js";
import type {
  AssignmentResult,
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

  async findById(id: string): Promise<TicketRecord | null> {
    const [ticket] = await this.database.select().from(tickets).where(eq(tickets.id, id)).limit(1);

    return ticket ?? null;
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
