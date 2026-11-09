import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";

import { createDatabase } from "./client.js";
import { PostgresTicketRepository } from "./postgres-ticket-repository.js";
import { ticketStatuses, type TicketPriority } from "../tickets/ticket-contract.js";
import {
  notifications,
  replyEndorsements,
  sessions,
  ticketReplies,
  ticketReplyVotes,
  ticketVotes,
  tickets,
  users
} from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const { database, close } = createDatabase(databaseUrl);
const actorId = "8d98734d-647b-4ae5-a9a3-59eb30c160a6";

describe("PostgresTicketRepository", () => {
  beforeEach(async () => {
    await database.delete(ticketReplies);
    await database.delete(tickets);
    await database.delete(sessions);
    await database.delete(users);
  });

  afterAll(close);

  it("persists and returns a ticket with database-generated fields", async () => {
    const repository = new PostgresTicketRepository(database);

    const created = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });

    const storedTickets = await database.select().from(tickets);

    expect(storedTickets).toHaveLength(1);
    expect(created).toMatchObject({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42",
      additionalInformation: null,
      status: "OPEN",
      priority: "MEDIUM",
      visibility: "PUBLIC",
      assignedTechnicianId: null
    });
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });

  it("lists the most recently created tickets first up to the limit", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = (title: string, createdAt: string) => ({
      title,
      description: "Description",
      setup: "Setup",
      createdAt: new Date(createdAt),
      updatedAt: new Date(createdAt)
    });
    await database
      .insert(tickets)
      .values([
        ticket("Oldest", "2026-09-27T12:00:00.000Z"),
        ticket("Newest", "2026-09-29T12:00:00.000Z"),
        ticket("Middle", "2026-09-28T12:00:00.000Z")
      ]);

    const listed = await repository.listRecent(2);

    expect(listed.map((listedTicket) => listedTicket.title)).toEqual(["Newest", "Middle"]);
  });

  it("filters tickets by visibility for anonymous users, owners, and technicians", async () => {
    const [owner, otherUser, technician] = await database
      .insert(users)
      .values([
        {
          name: "Ticket Owner",
          username: "ticket.owner",
          passwordHash: "not-used",
          role: "USER"
        },
        {
          name: "Other User",
          username: "other.user",
          passwordHash: "not-used",
          role: "USER"
        },
        {
          name: "IT Technician",
          username: "it.technician",
          passwordHash: "not-used",
          role: "TECHNICIAN"
        }
      ])
      .returning();
    const repository = new PostgresTicketRepository(database);
    const input = { description: "Description", setup: "Setup" };

    await repository.create({ ...input, title: "Public", visibility: "PUBLIC" });
    await repository.create(
      { ...input, title: "Authenticated", visibility: "AUTHENTICATED" },
      owner!
    );
    await repository.create({ ...input, title: "Private owner", visibility: "PRIVATE" }, owner!);
    await repository.create(
      { ...input, title: "Private other", visibility: "PRIVATE" },
      otherUser!
    );

    const titles = async (viewer: { id: string; role: "USER" | "TECHNICIAN" } | null) =>
      (await repository.listRecent(10, viewer)).map((ticket) => ticket.title).sort();

    expect(await titles(null)).toEqual(["Public"]);
    expect(await titles({ id: otherUser!.id, role: "USER" })).toEqual([
      "Authenticated",
      "Private other",
      "Public"
    ]);
    expect(await titles({ id: technician!.id, role: "TECHNICIAN" })).toEqual([
      "Authenticated",
      "Private other",
      "Private owner",
      "Public"
    ]);
  });

  it("filters by visibility before applying priority sorting and the limit", async () => {
    const [owner] = await database
      .insert(users)
      .values({
        name: "Ticket Owner",
        username: "priority.owner",
        passwordHash: "not-used",
        role: "USER"
      })
      .returning();
    const repository = new PostgresTicketRepository(database);
    const input = { description: "Description", setup: "Setup" };

    await repository.create({ ...input, title: "Public low", priority: "LOW" });
    await repository.create(
      { ...input, title: "Private owner high", priority: "HIGH", visibility: "PRIVATE" },
      owner!
    );

    const listed = await repository.listRecent(1, null, "priority");

    expect(listed.map((ticket) => ticket.title)).toEqual(["Public low"]);
  });

  it("sorts by priority then newest first before applying the limit", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = (title: string, priority: TicketPriority, createdAt: string) => ({
      title,
      description: "Description",
      setup: "Setup",
      priority,
      createdAt: new Date(createdAt),
      updatedAt: new Date(createdAt)
    });
    await database
      .insert(tickets)
      .values([
        ticket("Low newest", "LOW", "2026-09-30T12:00:00.000Z"),
        ticket("Medium older", "MEDIUM", "2026-09-26T12:00:00.000Z"),
        ticket("High older", "HIGH", "2026-09-27T12:00:00.000Z"),
        ticket("High newer", "HIGH", "2026-09-29T12:00:00.000Z"),
        ticket("Medium newer", "MEDIUM", "2026-09-28T12:00:00.000Z")
      ]);

    const titles = async (limit: number) =>
      (await repository.listRecent(limit, null, "priority")).map((listed) => listed.title);

    expect(await titles(5)).toEqual([
      "High newer",
      "High older",
      "Medium newer",
      "Medium older",
      "Low newest"
    ]);
    expect(await titles(3)).toEqual(["High newer", "High older", "Medium newer"]);
  });

  it("persists and returns every approved ticket status", async () => {
    await database.insert(tickets).values(
      ticketStatuses.map((status, index) => ({
        title: status,
        description: "Description",
        setup: "Setup",
        status,
        createdAt: new Date(`2026-09-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
        updatedAt: new Date(`2026-09-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`)
      }))
    );

    const storedStatuses = await database
      .select({ status: tickets.status })
      .from(tickets)
      .orderBy(asc(tickets.createdAt));

    expect(storedStatuses.map((ticket) => ticket.status)).toEqual(ticketStatuses);
  });

  it("advances through each adjacent status up to resolved and updates the timestamp", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });
    const initialUpdatedAt = new Date("2026-09-01T12:00:00.000Z");
    await database
      .update(tickets)
      .set({ updatedAt: initialUpdatedAt })
      .where(eq(tickets.id, ticket.id));

    for (const status of ["UNDER_REVIEW", "IN_PROGRESS", "RESOLVED"] as const) {
      const result = await repository.updateStatus(ticket.id, status, actorId);

      expect(result).toMatchObject({ type: "updated", ticket: { status } });
      if (result.type !== "updated") {
        throw new Error("Expected a successful status update");
      }
    }

    const finalTicket = await repository.findById(ticket.id);
    expect(finalTicket?.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
  });

  it("rejects skipped, backward, completion, and terminal transitions", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });

    expect(await repository.updateStatus(ticket.id, "IN_PROGRESS", actorId)).toEqual({
      type: "invalid-transition"
    });
    expect(await repository.updateStatus(ticket.id, "UNDER_REVIEW", actorId)).toMatchObject({
      type: "updated",
      ticket: { status: "UNDER_REVIEW" }
    });
    expect(await repository.updateStatus(ticket.id, "OPEN", actorId)).toEqual({
      type: "invalid-transition"
    });

    for (const status of ["IN_PROGRESS", "RESOLVED"] as const) {
      expect(await repository.updateStatus(ticket.id, status, actorId)).toMatchObject({
        type: "updated",
        ticket: { status }
      });
    }

    expect(await repository.updateStatus(ticket.id, "COMPLETED", actorId)).toEqual({
      type: "invalid-transition"
    });
    await database.update(tickets).set({ status: "COMPLETED" }).where(eq(tickets.id, ticket.id));
    expect(await repository.updateStatus(ticket.id, "RESOLVED", actorId)).toEqual({
      type: "invalid-transition"
    });
  });

  it("treats the current status as idempotent without changing updatedAt", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });
    const updatedAt = new Date("2026-09-01T12:00:00.000Z");
    await database
      .update(tickets)
      .set({ status: "IN_PROGRESS", updatedAt })
      .where(eq(tickets.id, ticket.id));

    const result = await repository.updateStatus(ticket.id, "IN_PROGRESS", actorId);

    expect(result).toMatchObject({ type: "unchanged", ticket: { status: "IN_PROGRESS" } });
    if (result.type !== "unchanged") {
      throw new Error("Expected an unchanged status update");
    }
    expect(result.ticket.updatedAt).toEqual(updatedAt);
  });

  it("reports an unknown ticket when updating status", async () => {
    const repository = new PostgresTicketRepository(database);

    expect(
      await repository.updateStatus("00000000-0000-4000-8000-000000000000", "UNDER_REVIEW", actorId)
    ).toEqual({ type: "ticket-not-found" });
  });

  it("finds a ticket by ID and returns null for an unknown ID", async () => {
    const repository = new PostgresTicketRepository(database);
    const created = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });

    expect(await repository.findById(created.id)).toEqual(created);
    expect(await repository.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("returns an attributed creator name unless the ticket was posted anonymously", async () => {
    const [user] = await database
      .insert(users)
      .values({
        name: "Uma User",
        username: "uma",
        passwordHash: "not-used",
        role: "USER"
      })
      .returning();
    const repository = new PostgresTicketRepository(database);
    const input = {
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    };

    const attributed = await repository.create(input, user!);
    const anonymous = await repository.create({ ...input, postAnonymously: true }, user!);
    const storedTickets = await database.select().from(tickets);

    expect(attributed.createdByName).toBe("Uma User");
    expect((await repository.findById(attributed.id))?.createdByName).toBe("Uma User");
    expect(anonymous.createdByName).toBeNull();
    expect((await repository.findById(anonymous.id))?.createdByName).toBeNull();
    expect(storedTickets.map((ticket) => ticket.creatorUserId)).toEqual([user!.id, user!.id]);
  });

  it("persists a reply and lists a ticket's most recent replies oldest first", async () => {
    const repository = new PostgresTicketRepository(database);
    const input = { title: "Title", description: "Description", setup: "Setup" };
    const ticket = await repository.create(input);
    const otherTicket = await repository.create(input);
    await database.insert(ticketReplies).values([
      { ticketId: ticket.id, body: "Second", createdAt: new Date("2026-09-28T12:00:00.000Z") },
      { ticketId: ticket.id, body: "First", createdAt: new Date("2026-09-27T12:00:00.000Z") },
      { ticketId: otherTicket.id, body: "Elsewhere" }
    ]);

    const created = await repository.createReply(ticket.id, "Third");

    expect(created).toMatchObject({
      ticketId: ticket.id,
      body: "Third",
      kind: "COMMENT",
      endorsements: []
    });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect((await repository.listRecentReplies(ticket.id, 10)).map((reply) => reply.body)).toEqual([
      "First",
      "Second",
      "Third"
    ]);
    expect((await repository.listRecentReplies(ticket.id, 2)).map((reply) => reply.body)).toEqual([
      "Second",
      "Third"
    ]);
  });

  it("stores a reply as a comment when no kind is given", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = await repository.create({
      title: "Title",
      description: "Description",
      setup: "Setup"
    });

    const [stored] = await database
      .insert(ticketReplies)
      .values({ ticketId: ticket.id, body: "Stored before reply kinds existed" })
      .returning();

    expect(stored?.kind).toBe("COMMENT");
  });

  it("rejects a reply to a ticket that does not exist", async () => {
    const repository = new PostgresTicketRepository(database);

    await expect(
      repository.createReply("00000000-0000-4000-8000-000000000000", "Orphan")
    ).rejects.toThrow();
  });

  it("assigns, reassigns, and unassigns technicians without changing status", async () => {
    const [firstTechnician, secondTechnician] = await database
      .insert(users)
      .values([
        {
          name: "First Technician",
          username: "first.tech",
          passwordHash: "not-used",
          role: "TECHNICIAN"
        },
        {
          name: "Second Technician",
          username: "second.tech",
          passwordHash: "not-used",
          role: "TECHNICIAN"
        }
      ])
      .returning();
    const repository = new PostgresTicketRepository(database);
    const created = await repository.create(
      {
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42"
      },
      firstTechnician!
    );

    const assigned = await repository.assignTechnician(created.id, firstTechnician!.id);
    const reassigned = await repository.assignTechnician(created.id, secondTechnician!.id);
    const unassigned = await repository.assignTechnician(created.id, null);

    expect(assigned).toMatchObject({
      type: "updated",
      ticket: { assignedTechnicianId: firstTechnician!.id, status: "OPEN" }
    });
    expect(reassigned).toMatchObject({
      type: "updated",
      ticket: { assignedTechnicianId: secondTechnician!.id, status: "OPEN" }
    });
    expect(unassigned).toMatchObject({
      type: "updated",
      ticket: {
        assignedTechnicianId: null,
        createdByName: "First Technician",
        status: "OPEN"
      }
    });
  });

  it("rejects assignment to a regular user", async () => {
    const [regularUser] = await database
      .insert(users)
      .values({
        name: "Uma User",
        username: "uma",
        passwordHash: "not-used",
        role: "USER"
      })
      .returning();
    const repository = new PostgresTicketRepository(database);
    const created = await repository.create({
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42"
    });

    const result = await repository.assignTechnician(created.id, regularUser!.id);

    expect(result).toEqual({ type: "invalid-technician" });
  });

  it("reports an unknown ticket", async () => {
    const repository = new PostgresTicketRepository(database);

    const result = await repository.assignTechnician("cc04d84c-9aee-4d35-8af3-999d861aaed6", null);

    expect(result).toEqual({ type: "ticket-not-found" });
  });
  it("persists account votes, switches/removes them, and keeps viewer state private", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = await repository.create({ title: "Voting", description: "Test", setup: "Test" });
    const reply = await repository.createReply(ticket.id, "Try a restart");
    const [first, second] = await database
      .insert(users)
      .values([
        { name: "First", username: "vote.first", passwordHash: "unused", role: "USER" as const },
        {
          name: "Second",
          username: "vote.second",
          passwordHash: "unused",
          role: "TECHNICIAN" as const
        }
      ])
      .returning();
    await Promise.all(
      Array.from({ length: 5 }, () => repository.setReplyVote(ticket.id, reply.id, first!.id, 1))
    );
    expect(await database.select().from(ticketReplyVotes)).toHaveLength(1);
    await repository.setReplyVote(ticket.id, reply.id, second!.id, -1);
    expect(await repository.listRecentReplies(ticket.id, 10, first!.id)).toMatchObject([
      { upvotes: 1, downvotes: 1, userVote: 1 }
    ]);
    expect(await repository.listRecentReplies(ticket.id, 10, second!.id)).toMatchObject([
      { upvotes: 1, downvotes: 1, userVote: -1 }
    ]);
    expect(await repository.listRecentReplies(ticket.id, 10)).toMatchObject([
      { upvotes: 1, downvotes: 1, userVote: null }
    ]);
    expect(await repository.setReplyVote(ticket.id, reply.id, first!.id, -1)).toEqual({
      type: "updated",
      vote: { upvotes: 0, downvotes: 2, userVote: -1 }
    });
    await repository.setReplyVote(ticket.id, reply.id, first!.id, null);
    expect(await repository.setReplyVote(ticket.id, reply.id, first!.id, null)).toEqual({
      type: "updated",
      vote: { upvotes: 0, downvotes: 1, userVote: null }
    });
    const storedTicket = await repository.findById(ticket.id);
    expect(storedTicket!.updatedAt).toEqual(ticket.updatedAt);
  });

  it("rejects cross-ticket voting and invalid database vote values", async () => {
    const repository = new PostgresTicketRepository(database);
    const input = { title: "Voting", description: "Test", setup: "Test" };
    const ticket = await repository.create(input);
    const other = await repository.create(input);
    const reply = await repository.createReply(ticket.id, "Reply");
    const [user] = await database
      .insert(users)
      .values({ name: "Voter", username: "voter", passwordHash: "unused", role: "USER" })
      .returning();
    expect(await repository.setReplyVote(other.id, reply.id, user!.id, 1)).toEqual({
      type: "reply-not-found"
    });
    expect(await repository.setReplyVote(other.id, reply.id, user!.id, null)).toEqual({
      type: "reply-not-found"
    });
    expect(await database.select().from(ticketReplyVotes)).toHaveLength(0);
    await expect(
      database.insert(ticketReplyVotes).values({ replyId: reply.id, userId: user!.id, value: 0 })
    ).rejects.toThrow();
    await repository.setReplyVote(ticket.id, reply.id, user!.id, 1);
    await database.delete(users);
    expect(await database.select().from(ticketReplyVotes)).toHaveLength(0);
  });
  it("persists independent ticket votes, serializes duplicates, and isolates each viewer", async () => {
    const repository = new PostgresTicketRepository(database);
    const ticket = await repository.create({
      title: "Ticket votes",
      description: "Test",
      setup: "Test"
    });
    const reply = await repository.createReply(ticket.id, "Reply");
    const [first, second] = await database
      .insert(users)
      .values([
        { name: "First", username: "ticket.first", passwordHash: "unused", role: "USER" as const },
        {
          name: "Second",
          username: "ticket.second",
          passwordHash: "unused",
          role: "TECHNICIAN" as const
        }
      ])
      .returning();
    expect(await repository.getTicketVote(ticket.id)).toEqual({
      upvotes: 0,
      downvotes: 0,
      userVote: null
    });
    await Promise.all(
      Array.from({ length: 5 }, () => repository.setTicketVote(ticket.id, first!.id, 1))
    );
    expect(await database.select().from(ticketVotes)).toHaveLength(1);
    await repository.setTicketVote(ticket.id, second!.id, -1);
    await repository.setReplyVote(ticket.id, reply.id, first!.id, -1);
    expect(await repository.getTicketVote(ticket.id, first!.id)).toEqual({
      upvotes: 1,
      downvotes: 1,
      userVote: 1
    });
    expect(await repository.getTicketVote(ticket.id, second!.id)).toEqual({
      upvotes: 1,
      downvotes: 1,
      userVote: -1
    });
    expect(await repository.getTicketVote(ticket.id)).toEqual({
      upvotes: 1,
      downvotes: 1,
      userVote: null
    });
    expect(await repository.listTicketVotes([ticket.id], first!.id)).toEqual([
      { ticketId: ticket.id, upvotes: 1, downvotes: 1, userVote: 1 }
    ]);
    expect(await repository.listTicketVotes([ticket.id])).toEqual([
      { ticketId: ticket.id, upvotes: 1, downvotes: 1, userVote: null }
    ]);
    expect(await repository.listTicketVotes([])).toEqual([]);
    const unvoted = await repository.create({
      title: "Unvoted",
      description: "Test",
      setup: "Test"
    });
    expect(await repository.listTicketVotes([unvoted.id], first!.id)).toEqual([
      { ticketId: unvoted.id, upvotes: 0, downvotes: 0, userVote: null }
    ]);

    expect(await repository.setTicketVote(ticket.id, first!.id, -1)).toEqual({
      type: "updated",
      vote: { upvotes: 0, downvotes: 2, userVote: -1 }
    });
    await repository.setTicketVote(ticket.id, first!.id, null);
    expect(await repository.setTicketVote(ticket.id, first!.id, null)).toEqual({
      type: "updated",
      vote: { upvotes: 0, downvotes: 1, userVote: null }
    });
    expect(await repository.listRecentReplies(ticket.id, 10, first!.id)).toMatchObject([
      { upvotes: 0, downvotes: 1, userVote: -1 }
    ]);
    expect((await repository.findById(ticket.id))!.updatedAt).toEqual(ticket.updatedAt);
  });

  it("rejects absent tickets and invalid ticket-vote values and cascades deletion", async () => {
    const repository = new PostgresTicketRepository(database);
    const absentId = "00000000-0000-4000-8000-000000000000";
    const [user] = await database
      .insert(users)
      .values({ name: "Voter", username: "ticket.voter", passwordHash: "unused", role: "USER" })
      .returning();
    expect(await repository.getTicketVote(absentId)).toBeNull();
    expect(await repository.setTicketVote(absentId, user!.id, 1)).toEqual({
      type: "ticket-not-found"
    });
    const ticket = await repository.create({ title: "Votes", description: "Test", setup: "Test" });
    await expect(
      database.insert(ticketVotes).values({ ticketId: ticket.id, userId: user!.id, value: 0 })
    ).rejects.toThrow();
    await repository.setTicketVote(ticket.id, user!.id, 1);
    await database.delete(tickets);
    expect(await database.select().from(ticketVotes)).toHaveLength(0);
  });

  describe("solution endorsements", () => {
    const input = { title: "Printer offline", description: "Description", setup: "Setup" };

    async function seed(status: (typeof ticketStatuses)[number] = "IN_PROGRESS") {
      const [owner, technician, otherTechnician] = await database
        .insert(users)
        .values([
          { name: "Ticket Owner", username: "owner", passwordHash: "x", role: "USER" },
          { name: "Dana Lee", username: "dana", passwordHash: "x", role: "TECHNICIAN" },
          { name: "Sam Park", username: "sam", passwordHash: "x", role: "TECHNICIAN" }
        ])
        .returning();
      const repository = new PostgresTicketRepository(database);
      const ticket = await repository.create(input, owner!);
      await database.update(tickets).set({ status }).where(eq(tickets.id, ticket.id));
      const solution = await repository.createReply(ticket.id, "Reinstall the driver.", "SOLUTION");
      const comment = await repository.createReply(ticket.id, "Same here.");

      return {
        repository,
        owner: owner!,
        technician: technician!,
        otherTechnician: otherTechnician!,
        ticket,
        solution,
        comment
      };
    }

    it("creates, replaces, and lists one endorsement per technician", async () => {
      const { repository, technician, otherTechnician, ticket, solution } = await seed();

      const first = await repository.endorseReply(ticket.id, solution.id, technician.id, {
        notes: "Use v4.2.",
        markResolved: false
      });
      await repository.endorseReply(ticket.id, solution.id, otherTechnician.id, {
        notes: null,
        markResolved: false
      });
      const replaced = await repository.endorseReply(ticket.id, solution.id, technician.id, {
        notes: "Use v4.3.",
        markResolved: false
      });

      expect(first).toMatchObject({ type: "endorsed", ticket: { status: "IN_PROGRESS" } });
      expect(replaced.type).toBe("endorsed");
      expect(await database.select().from(replyEndorsements)).toHaveLength(2);
      const [listed] = (await repository.listRecentReplies(ticket.id, 10)).filter(
        (reply) => reply.id === solution.id
      );
      expect(listed?.kind).toBe("SOLUTION");
      expect(listed?.endorsements).toMatchObject([
        { technicianId: technician.id, technicianName: "Dana Lee", notes: "Use v4.3." },
        { technicianId: otherTechnician.id, technicianName: "Sam Park", notes: null }
      ]);
      expect(listed!.endorsements[0]!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        listed!.endorsements[0]!.createdAt.getTime()
      );
    });

    it("rejects comments and replies that belong to another ticket", async () => {
      const { repository, technician, ticket, solution, comment } = await seed();
      const otherTicket = await repository.create(input);
      const endorse = { notes: null, markResolved: false };

      expect(await repository.endorseReply(ticket.id, comment.id, technician.id, endorse)).toEqual({
        type: "not-a-solution"
      });
      expect(
        await repository.endorseReply(otherTicket.id, solution.id, technician.id, endorse)
      ).toEqual({ type: "reply-not-found" });
      expect(await database.select().from(replyEndorsements)).toEqual([]);
    });

    it("resolves an in-progress ticket and notifies its owner in the same transaction", async () => {
      const { repository, owner, technician, ticket, solution } = await seed("IN_PROGRESS");

      const result = await repository.endorseReply(ticket.id, solution.id, technician.id, {
        notes: null,
        markResolved: true
      });

      expect(result).toMatchObject({ type: "endorsed", ticket: { status: "RESOLVED" } });
      expect(await database.select().from(notifications)).toMatchObject([
        {
          userId: owner.id,
          ticketId: ticket.id,
          previousStatus: "IN_PROGRESS",
          newStatus: "RESOLVED"
        }
      ]);
      expect(await database.select().from(replyEndorsements)).toHaveLength(1);
    });

    it("writes nothing when marking resolved would skip a stage", async () => {
      const { repository, technician, ticket, solution } = await seed("OPEN");

      const result = await repository.endorseReply(ticket.id, solution.id, technician.id, {
        notes: "Try this",
        markResolved: true
      });

      expect(result).toEqual({ type: "invalid-transition" });
      expect(await database.select().from(replyEndorsements)).toEqual([]);
      expect(await database.select().from(notifications)).toEqual([]);
      expect((await repository.findById(ticket.id))?.status).toBe("OPEN");
    });

    it("endorses an already resolved ticket without another notification", async () => {
      const { repository, technician, ticket, solution } = await seed("RESOLVED");

      const result = await repository.endorseReply(ticket.id, solution.id, technician.id, {
        notes: null,
        markResolved: true
      });

      expect(result).toMatchObject({ type: "endorsed", ticket: { status: "RESOLVED" } });
      expect(await database.select().from(notifications)).toEqual([]);
    });

    it("withdraws only the caller's endorsement on the matching ticket", async () => {
      const { repository, technician, otherTechnician, ticket, solution } = await seed();
      const otherTicket = await repository.create(input);
      const endorse = { notes: null, markResolved: false };
      await repository.endorseReply(ticket.id, solution.id, technician.id, endorse);
      await repository.endorseReply(ticket.id, solution.id, otherTechnician.id, endorse);

      expect(
        await repository.withdrawEndorsement(otherTicket.id, solution.id, technician.id)
      ).toEqual({ type: "endorsement-not-found" });
      expect(await repository.withdrawEndorsement(ticket.id, solution.id, technician.id)).toEqual({
        type: "withdrawn"
      });
      expect(await repository.withdrawEndorsement(ticket.id, solution.id, technician.id)).toEqual({
        type: "endorsement-not-found"
      });
      expect(await database.select().from(replyEndorsements)).toMatchObject([
        { technicianId: otherTechnician.id }
      ]);
    });

    it("removes endorsements with their technician or ticket", async () => {
      const { repository, technician, otherTechnician, ticket, solution } = await seed();
      const endorse = { notes: null, markResolved: false };
      await repository.endorseReply(ticket.id, solution.id, technician.id, endorse);
      await repository.endorseReply(ticket.id, solution.id, otherTechnician.id, endorse);

      await database.delete(users).where(eq(users.id, technician.id));
      expect(await database.select().from(replyEndorsements)).toHaveLength(1);

      await database.delete(tickets).where(eq(tickets.id, ticket.id));
      expect(await database.select().from(replyEndorsements)).toEqual([]);
    });
  });
});
