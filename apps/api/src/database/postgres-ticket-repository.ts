import { and, desc, eq, getTableColumns, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { notifications, ticketReplies, tickets, users } from "./schema.js";
import { canTechnicianChangeStatus, type TicketStatus } from "../tickets/ticket-contract.js";
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

  async updateStatus(
    ticketId: string,
    status: TicketStatus,
    actorUserId: string
  ): Promise<StatusUpdateResult> {
    return this.database.transaction(async (transaction) => {
      const readTicket = async (): Promise<TicketRecord> => {
        const [ticket] = await transaction
          .select({ ...getTableColumns(tickets), creatorName: users.name })
          .from(tickets)
          .leftJoin(users, eq(tickets.creatorUserId, users.id))
          .where(eq(tickets.id, ticketId))
          .limit(1);

        if (!ticket) {
          throw new Error("Ticket status update could not be read");
        }
        return toTicketRecord(ticket);
      };

      // Lock the row so concurrent changes cannot both pass the transition check.
      const [existing] = await transaction
        .select({ status: tickets.status, creatorUserId: tickets.creatorUserId })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .for("update")
        .limit(1);

      if (!existing) {
        return { type: "ticket-not-found" };
      }
      if (existing.status === status) {
        return { type: "unchanged", ticket: await readTicket() };
      }
      if (!canTechnicianChangeStatus(existing.status, status)) {
        return { type: "invalid-transition" };
      }

      await transaction
        .update(tickets)
        .set({ status, updatedAt: new Date() })
        .where(eq(tickets.id, ticketId));

      if (existing.creatorUserId && existing.creatorUserId !== actorUserId) {
        await transaction.insert(notifications).values({
          userId: existing.creatorUserId,
          ticketId,
          previousStatus: existing.status,
          newStatus: status
        });
      }

      return { type: "updated", ticket: await readTicket() };
    });
  }
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
