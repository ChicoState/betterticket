import { and, desc, eq, getTableColumns, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { ticketReplies, tickets, users } from "./schema.js";
import type {
  AssignmentResult,
  CreateTicketInput,
  TicketCreator,
  ReplyRecord,
  StatusUpdateResult,
  TicketRecord,
  TicketRepository,
  TicketViewer
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
        visibility: input.visibility ?? "PUBLIC",
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

  async listRecent(limit: number, viewer: TicketViewer | null = null): Promise<TicketRecord[]> {
    const visibilityFilter =
      viewer?.role === "TECHNICIAN"
        ? or(
            eq(tickets.visibility, "PUBLIC"),
            eq(tickets.visibility, "AUTHENTICATED"),
            eq(tickets.visibility, "PRIVATE")
          )
        : viewer
          ? or(
              eq(tickets.visibility, "PUBLIC"),
              eq(tickets.visibility, "AUTHENTICATED"),
              and(eq(tickets.visibility, "PRIVATE"), eq(tickets.creatorUserId, viewer.id))
            )
          : eq(tickets.visibility, "PUBLIC");
    const results = await this.database
      .select({ ...getTableColumns(tickets), creatorName: users.name })
      .from(tickets)
      .leftJoin(users, eq(tickets.creatorUserId, users.id))
      .where(visibilityFilter)
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
    creatorUserId: ticket.creatorUserId,
    createdByName: ticket.isAnonymous ? null : creatorName
  };
}
