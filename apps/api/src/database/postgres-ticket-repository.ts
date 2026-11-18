import {
  and,
  asc,
  desc,
  eq,
  exists,
  getTableColumns,
  ilike,
  inArray,
  or,
  sql,
  type SQL
} from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import {
  notifications,
  replyEndorsements,
  ticketAttachments,
  ticketReplies,
  ticketReplyVotes,
  ticketVotes,
  tickets,
  users
} from "./schema.js";
import {
  canOwnerCompleteTicket,
  canTechnicianChangeStatus,
  type ReplyKind,
  type TicketStatus
} from "../tickets/ticket-contract.js";
import type {
  AssignmentResult,
  AttachmentRecord,
  CompleteTicketResult,
  CreateTicketInput,
  EndorseReplyRecordInput,
  EndorseResult,
  EndorsementRecord,
  NewAttachmentRecord,
  ReplyRecord,
  ReplyCreationResult,
  SetReplyVoteResult,
  SetTicketVoteResult,
  StatusUpdateResult,
  TicketCreator,
  TicketRecord,
  TicketRepository,
  TicketSearch,
  TicketSort,
  TicketViewer,
  UpdateReplyStatusResult,
  VoteState,
  VoteValue,
  WithdrawResult
} from "../tickets/ticket-repository.js";
import type { TicketReplyStatus } from "../tickets/ticket-contract.js";

type Executor = Pick<NodePgDatabase, "select" | "insert" | "update" | "delete">;
type Transaction = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];

export class PostgresTicketRepository implements TicketRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async create(
    input: CreateTicketInput,
    creator: TicketCreator | null = null,
    attachments: NewAttachmentRecord[] = []
  ): Promise<TicketRecord> {
    return this.database.transaction(async (transaction) => {
      const [ticket] = await transaction
        .insert(tickets)
        .values({
          title: input.title,
          description: input.description,
          setup: input.setup,
          additionalInformation: input.additionalInformation,
          visibility: input.visibility ?? "PUBLIC",
          creatorUserId: creator?.id,
          isAnonymous: input.postAnonymously ?? false,
          priority: input.priority ?? "MEDIUM"
        })
        .returning();

      if (!ticket) {
        throw new Error("Ticket insert did not return a row");
      }

      if (attachments.length > 0) {
        await transaction.insert(ticketAttachments).values(
          attachments.map((attachment) => ({
            ...attachment,
            ticketId: ticket.id
          }))
        );
      }

      return {
        ...ticket,
        createdByName: input.postAnonymously ? null : (creator?.name ?? null)
      };
    });
  }

  async listRecent(
    limit: number,
    viewer: TicketViewer | null = null,
    sort: TicketSort = "votes",
    search?: TicketSearch
  ): Promise<TicketRecord[]> {
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
    const terms = (search?.terms ?? []).map((term) => this.searchTerm(term));
    if (search && terms.length === 0) {
      return [];
    }

    const matches = terms.map((term) => term.matches);
    const searchFilter = search?.match === "any" ? or(...matches) : and(...matches);
    const newestFirst = [desc(tickets.createdAt), desc(tickets.id)];
    const sortOrder =
      sort === "priority"
        ? [
            sql`CASE ${tickets.priority} WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END`,
            ...newestFirst
          ]
        : sort === "votes"
          ? [
              desc(
                sql`(select coalesce(sum(${ticketVotes.value}), 0) from ${ticketVotes} where ${ticketVotes.ticketId} = ${tickets.id})`
              ),
              ...newestFirst
            ]
          : newestFirst;
    // Best matches first: tickets containing more of the terms, and exact rather than misspelled
    // ones. A similar-ticket search has no other order; a plain search then applies the sort.
    const relevance = desc(
      sql.join(
        terms.map((term) => term.score),
        sql` + `
      )
    );
    const orderBy = !search
      ? sortOrder
      : search.match === "any"
        ? [relevance, ...newestFirst]
        : [relevance, ...sortOrder];
    const results = await this.database
      .select({ ...getTableColumns(tickets), creatorName: users.name })
      .from(tickets)
      .leftJoin(users, eq(tickets.creatorUserId, users.id))
      .where(and(visibilityFilter, searchFilter))
      .orderBy(...orderBy)
      .limit(limit);

    return results.map(toTicketRecord);
  }

  /**
   * Builds the condition and relevance score for one search term. A term matches when it appears
   * in the ticket's own text or in any of its replies. Punctuation is ignored on both sides, so
   * "wifi" finds "Wi-Fi"; a term made only of punctuation is matched literally instead. Longer
   * words also match a similar word or one with two letters swapped, so "pritner" finds
   * "printer", at half the score.
   */
  private searchTerm(term: string): { matches: SQL; score: SQL } {
    const plainTerm = term.replace(/[^\p{L}\p{N}]+/gu, "");
    const pattern = `%${plainTerm || escapeLikePattern(term)}%`;
    const text = (column: SQL | AnyPgColumn) => (plainTerm ? withoutPunctuation(column) : column);
    const exact = this.inAnySearchedText((column) => ilike(text(column), pattern));

    if (!fuzzyTermPattern.test(plainTerm)) {
      return { matches: exact, score: sql`(${exact})::int` };
    }

    const swapped = sql.join(
      swapAdjacentLetters(plainTerm).map((variant) => sql`${`%${variant}%`}`),
      sql`, `
    );
    const similar = this.inAnySearchedText((column) => {
      const plainText = withoutPunctuation(column);
      return sql`(word_similarity(${plainTerm}, ${plainText}) >= ${sql.raw(String(fuzzyWordSimilarity))} or ${plainText} ilike any (array[${swapped}]))`;
    });

    return {
      matches: sql`(${exact} or ${similar})`,
      score: sql`(case when ${exact} then 1 when ${similar} then 0.5 else 0 end)`
    };
  }

  /** True when the predicate holds for one of the ticket's text fields or one of its replies. */
  private inAnySearchedText(predicate: (column: SQL | AnyPgColumn) => SQL): SQL {
    const condition = or(
      predicate(tickets.title),
      predicate(tickets.description),
      predicate(tickets.setup),
      // Without the fallback a missing value makes a non-match NULL, which breaks the ranking.
      predicate(sql`coalesce(${tickets.additionalInformation}, '')`),
      exists(
        this.database
          .select({ id: ticketReplies.id })
          .from(ticketReplies)
          .where(and(eq(ticketReplies.ticketId, tickets.id), predicate(ticketReplies.body)))
      )
    );
    if (!condition) {
      throw new Error("Ticket search condition could not be built");
    }

    return condition;
  }

  async findById(id: string): Promise<TicketRecord | null> {
    return findTicket(this.database, id);
  }

  async listAttachments(ticketId: string): Promise<AttachmentRecord[]> {
    return this.database
      .select()
      .from(ticketAttachments)
      .where(eq(ticketAttachments.ticketId, ticketId))
      .orderBy(asc(ticketAttachments.createdAt), asc(ticketAttachments.id));
  }

  async findAttachment(ticketId: string, attachmentId: string): Promise<AttachmentRecord | null> {
    const [attachment] = await this.database
      .select()
      .from(ticketAttachments)
      .where(and(eq(ticketAttachments.ticketId, ticketId), eq(ticketAttachments.id, attachmentId)))
      .limit(1);

    return attachment ?? null;
  }

  async createReply(
    ticketId: string,
    body: string,
    kind: ReplyKind = "COMMENT"
  ): Promise<ReplyCreationResult> {
    const [reply] = await this.database
      .insert(ticketReplies)
      .select(
        this.database
          .select({
            id: sql<string>`gen_random_uuid()`.as("id"),
            ticketId: tickets.id,
            kind: sql<ReplyKind>`${kind}::reply_kind`.as("kind"),
            body: sql<string>`${body}`.as("body"),
            createdAt: sql<Date>`now()`.as("created_at")
          })
          .from(tickets)
          .where(and(eq(tickets.id, ticketId), eq(tickets.replyStatus, "OPEN")))
      )
      .returning();

    if (reply) {
      return {
        type: "created",
        reply: { ...reply, endorsements: [], upvotes: 0, downvotes: 0, userVote: null }
      };
    }

    return (await this.findById(ticketId))
      ? { type: "ticket-closed" }
      : { type: "ticket-not-found" };
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

    return withEndorsements(this.database, newestFirst.reverse());
  }

  async endorseReply(
    ticketId: string,
    replyId: string,
    technicianId: string,
    input: EndorseReplyRecordInput
  ): Promise<EndorseResult> {
    return this.database.transaction(async (transaction) => {
      const [reply] = await transaction
        .select({ ...getTableColumns(ticketReplies), ...replyVoteColumns(technicianId) })
        .from(ticketReplies)
        .where(and(eq(ticketReplies.id, replyId), eq(ticketReplies.ticketId, ticketId)))
        .limit(1);

      if (!reply) {
        return { type: "reply-not-found" };
      }
      if (reply.kind !== "SOLUTION") {
        return { type: "not-a-solution" };
      }

      // Change the status first: an invalid transition writes nothing, so returning early leaves
      // the transaction without an endorsement.
      if (input.markResolved) {
        const status = await changeStatus(transaction, ticketId, "RESOLVED", technicianId);
        if (status === "invalid-transition") {
          return { type: "invalid-transition" };
        }
        if (status === "ticket-not-found") {
          return { type: "reply-not-found" };
        }
      }

      const now = new Date();
      await transaction
        .insert(replyEndorsements)
        .values({ replyId, technicianId, notes: input.notes })
        .onConflictDoUpdate({
          target: [replyEndorsements.replyId, replyEndorsements.technicianId],
          set: { notes: input.notes, updatedAt: now }
        });

      const [endorsedReply] = await withEndorsements(transaction, [reply]);
      const ticket = await findTicket(transaction, ticketId);
      if (!endorsedReply || !ticket) {
        throw new Error("Endorsement could not be read");
      }

      return { type: "endorsed", reply: endorsedReply, ticket };
    });
  }

  async withdrawEndorsement(
    ticketId: string,
    replyId: string,
    technicianId: string
  ): Promise<WithdrawResult> {
    const ticketReply = this.database
      .select({ id: ticketReplies.id })
      .from(ticketReplies)
      .where(and(eq(ticketReplies.id, replyId), eq(ticketReplies.ticketId, ticketId)));

    const deleted = await this.database
      .delete(replyEndorsements)
      .where(
        and(
          inArray(replyEndorsements.replyId, ticketReply),
          eq(replyEndorsements.technicianId, technicianId)
        )
      )
      .returning({ id: replyEndorsements.id });

    return deleted.length > 0 ? { type: "withdrawn" } : { type: "endorsement-not-found" };
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

  async completeTicket(ticketId: string, ownerUserId: string): Promise<CompleteTicketResult> {
    return this.database.transaction(async (transaction) => {
      // Lock the row so a concurrent status change cannot race the RESOLVED check.
      const [existing] = await transaction
        .select({ status: tickets.status, creatorUserId: tickets.creatorUserId })
        .from(tickets)
        .where(eq(tickets.id, ticketId))
        .for("update")
        .limit(1);

      if (!existing) {
        return { type: "ticket-not-found" };
      }
      if (existing.creatorUserId === null || existing.creatorUserId !== ownerUserId) {
        return { type: "not-owner" };
      }

      let type: "updated" | "unchanged" = "unchanged";
      if (existing.status !== "COMPLETED") {
        if (!canOwnerCompleteTicket(existing.status)) {
          return { type: "invalid-transition" };
        }
        await transaction
          .update(tickets)
          .set({ status: "COMPLETED", updatedAt: new Date() })
          .where(eq(tickets.id, ticketId));
        type = "updated";
      }

      const ticket = await findTicket(transaction, ticketId);
      if (!ticket) {
        throw new Error("Ticket completion could not be read");
      }
      return { type, ticket };
    });
  }

  async updateStatus(
    ticketId: string,
    status: TicketStatus,
    actorUserId: string
  ): Promise<StatusUpdateResult> {
    return this.database.transaction(async (transaction) => {
      const result = await changeStatus(transaction, ticketId, status, actorUserId);
      if (result === "ticket-not-found" || result === "invalid-transition") {
        return { type: result };
      }

      const ticket = await findTicket(transaction, ticketId);
      if (!ticket) {
        throw new Error("Ticket status update could not be read");
      }
      return { type: result, ticket };
    });
  }
}

// Only words of letters this long are matched approximately: shorter words and numbers such as
// room or version numbers are too easily confused with a different one.
const fuzzyTermPattern = /^\p{L}{4,}$/u;

// The share of a term's trigrams that a word in the text must contain (pg_trgm word_similarity).
// 0.5 accepts one missing or wrong letter in a word of six or more letters.
const fuzzyWordSimilarity = 0.5;

const maxSwappedTermLength = 24;

/**
 * The term with each pair of neighbouring letters swapped. Swapped letters are a common typing
 * mistake that shares too few trigrams with the intended word for similarity to catch.
 */
function swapAdjacentLetters(term: string): string[] {
  const letters = [...term].slice(0, maxSwappedTermLength);
  const variants = new Set<string>();

  for (let index = 0; index < letters.length - 1; index += 1) {
    const swapped = [...letters];
    [swapped[index], swapped[index + 1]] = [letters[index + 1]!, letters[index]!];
    variants.add(swapped.join(""));
  }
  variants.delete(letters.join(""));

  // A term of one repeated letter has no variants; keep the array non-empty for the query.
  return variants.size > 0 ? [...variants] : [letters.join("")];
}

/** The column's text with everything except letters, digits, and whitespace removed. */
function withoutPunctuation(column: SQL | AnyPgColumn): SQL {
  return sql`regexp_replace(${column}, '[^[:alnum:][:space:]]+', '', 'g')`;
}

/** Escapes the characters `LIKE` treats specially so a search term is matched literally. */
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

async function findTicket(executor: Executor, id: string): Promise<TicketRecord | null> {
  const [ticket] = await executor
    .select({ ...getTableColumns(tickets), creatorName: users.name })
    .from(tickets)
    .leftJoin(users, eq(tickets.creatorUserId, users.id))
    .where(eq(tickets.id, id))
    .limit(1);

  return ticket ? toTicketRecord(ticket) : null;
}

/**
 * Applies a technician status change and notifies the ticket's creator. Must run inside a
 * transaction; it writes nothing unless the change is valid.
 */
async function changeStatus(
  transaction: Transaction,
  ticketId: string,
  status: TicketStatus,
  actorUserId: string
): Promise<"updated" | "unchanged" | "ticket-not-found" | "invalid-transition"> {
  // Lock the row so concurrent changes cannot both pass the transition check.
  const [existing] = await transaction
    .select({ status: tickets.status, creatorUserId: tickets.creatorUserId })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .for("update")
    .limit(1);

  if (!existing) {
    return "ticket-not-found";
  }
  if (existing.status === status) {
    return "unchanged";
  }
  if (!canTechnicianChangeStatus(existing.status, status)) {
    return "invalid-transition";
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

  return "updated";
}

async function withEndorsements(
  executor: Executor,
  replies: Array<Omit<ReplyRecord, "endorsements">>
): Promise<ReplyRecord[]> {
  const replyIds = replies.map((reply) => reply.id);
  const rows =
    replyIds.length === 0
      ? []
      : await executor
          .select({
            id: replyEndorsements.id,
            replyId: replyEndorsements.replyId,
            technicianId: replyEndorsements.technicianId,
            technicianName: users.name,
            notes: replyEndorsements.notes,
            createdAt: replyEndorsements.createdAt,
            updatedAt: replyEndorsements.updatedAt
          })
          .from(replyEndorsements)
          .innerJoin(users, eq(replyEndorsements.technicianId, users.id))
          .where(inArray(replyEndorsements.replyId, replyIds))
          .orderBy(asc(replyEndorsements.createdAt), asc(replyEndorsements.id));

  const byReply = new Map<string, EndorsementRecord[]>();
  for (const { replyId, ...endorsement } of rows) {
    byReply.set(replyId, [...(byReply.get(replyId) ?? []), endorsement]);
  }

  return replies.map((reply) => ({ ...reply, endorsements: byReply.get(reply.id) ?? [] }));
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
