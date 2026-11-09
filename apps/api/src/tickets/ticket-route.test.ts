import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import {
  canTechnicianChangeStatus,
  ticketStatuses,
  type ReplyKind,
  type TicketStatus
} from "./ticket-contract.js";
import type { AuthenticatedUser, UserRole } from "../auth/auth-contract.js";
import type { AuthRepository, CreatedSession } from "../auth/auth-repository.js";
import type {
  AssignmentResult,
  CreateTicketInput,
  EndorseReplyRecordInput,
  EndorseResult,
  ReplyCreationResult,
  TicketCreator,
  ReplyRecord,
  StatusUpdateResult,
  TicketRecord,
  TicketRepository,
  WithdrawResult
} from "./ticket-repository.js";
import type { NotificationRepository } from "../notifications/notification-repository.js";
import type { SettingsRepository } from "../settings/settings-repository.js";
import type { Ticket } from "./ticket-contract.js";

const technicianId = "8d98734d-647b-4ae5-a9a3-59eb30c160a6";
const ticketId = "cc04d84c-9aee-4d35-8af3-999d861aaed6";

class FakeAuthRepository implements AuthRepository {
  private readonly sessions = new Map<string, AuthenticatedUser>([
    [
      "technician-session",
      { id: technicianId, name: "Terry Technician", username: "terry", role: "TECHNICIAN" }
    ],
    [
      "user-session",
      {
        id: "bb97588e-0e8b-49e1-980b-4b9207121898",
        name: "Uma User",
        username: "uma",
        role: "USER"
      }
    ],
    [
      "other-user-session",
      {
        id: "cc086f3d-2c21-4c63-a4d4-5a5d0d3e7b9c",
        name: "Oliver Other",
        username: "oliver",
        role: "USER"
      }
    ]
  ]);

  async createSession(): Promise<CreatedSession | null> {
    throw new Error("not used");
  }

  async findUserBySession(token: string): Promise<AuthenticatedUser | null> {
    const user = this.sessions.get(token);
    return user ? { ...user } : null;
  }

  async deleteSession(): Promise<void> {
    throw new Error("not used");
  }

  async createUser(): Promise<AuthenticatedUser | null> {
    throw new Error("not used");
  }

  async setUserRole(username: string, role: UserRole): Promise<AuthenticatedUser | null> {
    const user = [...this.sessions.values()].find((stored) => stored.username === username);
    if (!user) {
      return null;
    }

    user.role = role;
    return { ...user };
  }
}

const authRepository = new FakeAuthRepository();

class FakeTicketRepository implements TicketRepository {
  readonly created: CreateTicketInput[] = [];
  readonly creators: Array<{ id: string; name: string } | null> = [];
  readonly listLimits: number[] = [];
  readonly listSorts: Array<"votes" | "newest" | "priority" | undefined> = [];
  readonly createdReplies: Array<{ ticketId: string; body: string; kind?: ReplyKind }> = [];
  readonly replyListLimits: number[] = [];
  readonly endorsements: Array<{
    ticketId: string;
    replyId: string;
    technicianId: string;
    input: EndorseReplyRecordInput;
  }> = [];
  readonly withdrawals: Array<{ ticketId: string; replyId: string; technicianId: string }> = [];
  endorseResult: EndorseResult = { type: "reply-not-found" };
  replyCreationFailure: Exclude<ReplyCreationResult, { type: "created" }> | null = null;
  withdrawResult: WithdrawResult = { type: "endorsement-not-found" };

  constructor(
    private readonly stored: TicketRecord[] = [],
    private readonly storedReplies: ReplyRecord[] = []
  ) {}

  async create(
    input: CreateTicketInput,
    creator: TicketCreator | null = null
  ): Promise<TicketRecord> {
    this.created.push(input);
    this.creators.push(creator ? { id: creator.id, name: creator.name } : null);

    return {
      id: ticketId,
      ...input,
      additionalInformation: input.additionalInformation ?? null,
      status: "OPEN",
      priority: input.priority ?? "MEDIUM",
      visibility: input.visibility ?? "PUBLIC",
      creatorUserId: creator?.id ?? null,
      assignedTechnicianId: null,
      createdByName: input.postAnonymously ? null : (creator?.name ?? null),
      createdAt: new Date("2026-09-28T18:00:00.000Z"),
      updatedAt: new Date("2026-09-28T18:00:00.000Z")
    };
  }

  async listRecent(
    limit: number,
    _viewer?: { id: string; role: "USER" | "TECHNICIAN" } | null,
    sort?: "votes" | "newest" | "priority"
  ): Promise<TicketRecord[]> {
    this.listLimits.push(limit);
    this.listSorts.push(sort);

    return this.stored;
  }

  async findById(id: string): Promise<TicketRecord | null> {
    return this.stored.find((ticket) => ticket.id === id) ?? null;
  }

  async createReply(
    ticketId: string,
    body: string,
    kind?: ReplyKind
  ): Promise<ReplyCreationResult> {
    this.createdReplies.push({ ticketId, body, kind });
    if (this.replyCreationFailure) {
      return this.replyCreationFailure;
    }

    return {
      type: "created",
      reply: {
        id: "5d4c1f0e-6f0a-4a57-9d0b-3a0b6a1f2c11",
        ticketId,
        kind: kind ?? "COMMENT",
        body,
        upvotes: 0,
        downvotes: 0,
        userVote: null,
        createdAt: new Date("2026-10-07T18:00:00.000Z"),
        endorsements: []
      }
    };
  }

  async listRecentReplies(ticketId: string, limit: number): Promise<ReplyRecord[]> {
    this.replyListLimits.push(limit);

    return this.storedReplies.filter((reply) => reply.ticketId === ticketId);
  }

  async listTicketVotes(
    ticketIds: string[]
  ): Promise<Array<import("./ticket-repository.js").VoteState & { ticketId: string }>> {
    return ticketIds.map((ticketId) => ({ ticketId, upvotes: 0, downvotes: 0, userVote: null }));
  }

  async getTicketVote(): Promise<import("./ticket-repository.js").VoteState | null> {
    throw new Error("not used");
  }
  async setTicketVote(): Promise<import("./ticket-repository.js").SetTicketVoteResult> {
    throw new Error("not used");
  }

  async setReplyVote(): Promise<import("./ticket-repository.js").SetReplyVoteResult> {
    throw new Error("not used");
  }

  async assignTechnician(): Promise<AssignmentResult> {
    throw new Error("not used");
  }

  async updateStatus(): Promise<StatusUpdateResult> {
    throw new Error("not used");
  }

  async endorseReply(
    ticketId: string,
    replyId: string,
    technicianId: string,
    input: EndorseReplyRecordInput
  ): Promise<EndorseResult> {
    this.endorsements.push({ ticketId, replyId, technicianId, input });
    return this.endorseResult;
  }

  async withdrawEndorsement(
    ticketId: string,
    replyId: string,
    technicianId: string
  ): Promise<WithdrawResult> {
    this.withdrawals.push({ ticketId, replyId, technicianId });
    return this.withdrawResult;
  }
}

const notificationRepository: NotificationRepository = {
  listRecent: vi.fn(),
  markAllRead: vi.fn()
};

const unusedSettingsRepository: SettingsRepository = {
  findNotificationSettings: async () => {
    throw new Error("not used");
  },
  saveNotificationSettings: async () => {
    throw new Error("not used");
  }
};

describe("POST /api/tickets", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("creates an anonymous ticket with normalized input", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      payload: {
        title: "  Laptop will not start  ",
        description: "  The power light flashes once.  ",
        setup: "  Framework Laptop 13, Fedora 42  ",
        additionalInformation: "  Started after an update.  "
      }
    });

    expect(response.statusCode).toBe(201);
    expect(repository.created).toEqual([
      {
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42",
        priority: "MEDIUM",
        additionalInformation: "Started after an update."
      }
    ]);
    expect(response.json()).toEqual({
      id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42",
      additionalInformation: "Started after an update.",
      status: "OPEN",
      replyStatus: "OPEN",
      canManageReplyStatus: false,
      priority: "MEDIUM",
      visibility: "PUBLIC",
      canReply: true,
      assignedTechnicianId: null,
      createdByName: null,
      createdAt: "2026-09-28T18:00:00.000Z",
      updatedAt: "2026-09-28T18:00:00.000Z"
    });
  });

  it("retains a signed-in anonymous poster privately without exposing their name", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie: "betterticket_session=user-session" },
      payload: {
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42",
        postAnonymously: true
      }
    });

    expect(response.statusCode).toBe(201);
    expect(repository.creators).toEqual([
      { id: "bb97588e-0e8b-49e1-980b-4b9207121898", name: "Uma User" }
    ]);
    expect(response.json()).toMatchObject({ createdByName: null });
  });

  it.each(["LOW", "MEDIUM", "HIGH"] as const)(
    "accepts %s priority and returns it",
    async (priority) => {
      const repository = new FakeTicketRepository();
      const app = buildApp({
        authRepository,
        ticketRepository: repository,
        notificationRepository,
        settingsRepository: unusedSettingsRepository,
        logger: false
      });
      apps.push(app);

      const response = await app.inject({
        method: "POST",
        url: "/api/tickets",
        payload: {
          title: "Laptop will not start",
          description: "The power light flashes once.",
          setup: "Framework Laptop 13, Fedora 42",
          priority
        }
      });

      expect(response.statusCode).toBe(201);
      expect(repository.created[0]?.priority).toBe(priority);
      expect(response.json()).toMatchObject({ priority });
    }
  );

  it("rejects invalid priority values without writing", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      payload: {
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42",
        priority: "URGENT"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(repository.created).toHaveLength(0);
  });

  it("shows the signed-in poster's display name when they do not choose anonymity", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { cookie: "betterticket_session=user-session" },
      payload: {
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ createdByName: "Uma User" });
  });

  it.each([
    ["blank title", { title: "   ", description: "Issue", setup: "Setup" }],
    [
      "unknown property",
      {
        title: "Issue",
        description: "Description",
        setup: "Setup",
        status: "CLOSED"
      }
    ],
    [
      "invalid visibility",
      { title: "Issue", description: "Description", setup: "Setup", visibility: "FRIENDS" }
    ],
    ["oversized description", { title: "Issue", description: "x".repeat(5_001), setup: "Setup" }]
  ])("rejects %s without writing", async (_name, payload) => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Ticket details are invalid"
      }
    });
    expect(repository.created).toHaveLength(0);
  });

  it("stores omitted additional information as null", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      payload: {
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ additionalInformation: null });
  });

  it("does not expose persistence errors", async () => {
    const repository: TicketRepository = {
      create: vi.fn().mockRejectedValue(new Error("password=database-secret")),
      listRecent: vi.fn(),
      findById: vi.fn(),
      createReply: vi.fn(),
      listRecentReplies: vi.fn(),
      listTicketVotes: vi.fn(),
      getTicketVote: vi.fn(),
      setTicketVote: vi.fn(),
      setReplyVote: vi.fn(),
      assignTechnician: vi.fn(),
      updateStatus: vi.fn(),
      endorseReply: vi.fn(),
      withdrawEndorsement: vi.fn()
    };
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      payload: {
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42"
      }
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("database-secret");
    expect(response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "The ticket request could not be completed"
      }
    });
  });
});

describe("GET /api/tickets", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("returns stored tickets in repository order without signing in", async () => {
    const repository = new FakeTicketRepository([
      {
        id: "2f1c5b0e-6f0a-4c59-9a55-0f6f2f4c8f11",
        title: "Printer is offline",
        description: "Jobs stay queued.",
        setup: "Office printer, macOS 15",
        additionalInformation: null,
        status: "OPEN",
        priority: "MEDIUM",
        visibility: "PUBLIC",
        creatorUserId: null,
        assignedTechnicianId: null,
        createdByName: null,
        createdAt: new Date("2026-09-29T09:30:00.000Z"),
        updatedAt: new Date("2026-09-29T09:30:00.000Z")
      },
      {
        id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42",
        additionalInformation: "Started after an update.",
        status: "OPEN",
        priority: "MEDIUM",
        visibility: "PUBLIC",
        creatorUserId: null,
        assignedTechnicianId: null,
        createdByName: null,
        createdAt: new Date("2026-09-28T18:00:00.000Z"),
        updatedAt: new Date("2026-09-28T18:00:00.000Z")
      }
    ]);
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/tickets" });

    expect(response.statusCode).toBe(200);
    expect(repository.listLimits).toEqual([100]);
    expect(response.json()).toEqual({
      tickets: [
        {
          id: "2f1c5b0e-6f0a-4c59-9a55-0f6f2f4c8f11",
          title: "Printer is offline",
          description: "Jobs stay queued.",
          setup: "Office printer, macOS 15",
          additionalInformation: null,
          status: "OPEN",
          replyStatus: "OPEN",
          canManageReplyStatus: false,
          priority: "MEDIUM",
          visibility: "PUBLIC",
          canReply: true,
          assignedTechnicianId: null,
          createdByName: null,
          createdAt: "2026-09-29T09:30:00.000Z",
          updatedAt: "2026-09-29T09:30:00.000Z",
          votes: { upvotes: 0, downvotes: 0, userVote: null }
        },
        {
          id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
          title: "Laptop will not start",
          description: "The power light flashes once.",
          setup: "Framework Laptop 13, Fedora 42",
          additionalInformation: "Started after an update.",
          status: "OPEN",
          replyStatus: "OPEN",
          canManageReplyStatus: false,
          priority: "MEDIUM",
          visibility: "PUBLIC",
          canReply: true,
          assignedTechnicianId: null,
          createdByName: null,
          createdAt: "2026-09-28T18:00:00.000Z",
          updatedAt: "2026-09-28T18:00:00.000Z",
          votes: { upvotes: 0, downvotes: 0, userVote: null }
        }
      ]
    });
  });

  it("returns an empty list when no tickets exist", async () => {
    const app = buildApp({
      authRepository,
      ticketRepository: new FakeTicketRepository(),
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/tickets" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ tickets: [] });
  });

  it("passes priority sorting to the repository while preserving visibility context", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/tickets?sort=priority",
      headers: { cookie: "betterticket_session=user-session" }
    });

    expect(response.statusCode).toBe(200);
    expect(repository.listLimits).toEqual([100]);
    expect(repository.listSorts).toEqual(["priority"]);
  });

  it("ignores unknown list query parameters and rejects unknown sort values", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const ignored = await app.inject({ method: "GET", url: "/api/tickets?utm_source=newsletter" });
    const rejected = await app.inject({ method: "GET", url: "/api/tickets?sort=oldest" });

    expect(ignored.statusCode).toBe(200);
    expect(rejected.statusCode).toBe(400);
    expect(repository.listSorts).toEqual(["votes"]);
  });

  it.each(ticketStatuses)("returns %s as an approved ticket status", async (status) => {
    const repository = new FakeTicketRepository([
      {
        id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
        title: "Laptop will not start",
        description: "The power light flashes once.",
        setup: "Framework Laptop 13, Fedora 42",
        additionalInformation: null,
        status: status as TicketStatus,
        priority: "MEDIUM",
        visibility: "PUBLIC",
        creatorUserId: null,
        assignedTechnicianId: null,
        createdByName: null,
        createdAt: new Date("2026-09-28T18:00:00.000Z"),
        updatedAt: new Date("2026-09-30T10:15:00.000Z")
      }
    ]);
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/tickets" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ tickets: [{ status }] });
  });

  it("does not expose persistence errors", async () => {
    const repository: TicketRepository = {
      create: vi.fn(),
      listRecent: vi.fn().mockRejectedValue(new Error("password=database-secret")),
      findById: vi.fn(),
      createReply: vi.fn(),
      listRecentReplies: vi.fn(),
      listTicketVotes: vi.fn(),
      getTicketVote: vi.fn(),
      setTicketVote: vi.fn(),
      setReplyVote: vi.fn(),
      assignTechnician: vi.fn(),
      updateStatus: vi.fn(),
      endorseReply: vi.fn(),
      withdrawEndorsement: vi.fn()
    };
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/tickets" });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("database-secret");
    expect(response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "The ticket request could not be completed"
      }
    });
  });
});

describe("ticket visibility authorization", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];
  const publicTicket: TicketRecord = {
    id: "2f1c5b0e-6f0a-4c59-9a55-0f6f2f4c8f11",
    title: "Public ticket",
    description: "Description",
    setup: "Setup",
    additionalInformation: null,
    status: "OPEN",
    priority: "MEDIUM",
    visibility: "PUBLIC",
    creatorUserId: null,
    assignedTechnicianId: null,
    createdByName: null,
    createdAt: new Date("2026-09-29T09:30:00.000Z"),
    updatedAt: new Date("2026-09-29T09:30:00.000Z")
  };
  const authenticatedTicket: TicketRecord = {
    ...publicTicket,
    id: ticketId,
    visibility: "AUTHENTICATED"
  };
  const privateTicket: TicketRecord = {
    ...publicTicket,
    id: "7b2e4d5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f",
    visibility: "PRIVATE",
    creatorUserId: "bb97588e-0e8b-49e1-980b-4b9207121898"
  };

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("allows public tickets to be listed and read anonymously", async () => {
    const app = buildApp({
      authRepository,
      ticketRepository: new FakeTicketRepository([publicTicket]),
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    expect((await app.inject({ method: "GET", url: "/api/tickets" })).json().tickets).toHaveLength(
      1
    );
    expect(
      (await app.inject({ method: "GET", url: `/api/tickets/${publicTicket.id}` })).statusCode
    ).toBe(200);
  });

  it("hides authenticated and private tickets from anonymous users", async () => {
    const app = buildApp({
      authRepository,
      ticketRepository: new FakeTicketRepository([
        publicTicket,
        authenticatedTicket,
        privateTicket
      ]),
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const list = await app.inject({ method: "GET", url: "/api/tickets" });
    expect(list.json().tickets.map((ticket: Ticket) => ticket.id)).toEqual([publicTicket.id]);
    expect(
      (await app.inject({ method: "GET", url: `/api/tickets/${privateTicket.id}` })).statusCode
    ).toBe(404);
  });

  it.each([undefined, "UNKNOWN"] as const)(
    "fails closed when a ticket has invalid visibility data (%s)",
    async (visibility) => {
      const malformedTicket = {
        ...publicTicket,
        visibility
      } as unknown as TicketRecord;
      const app = buildApp({
        authRepository,
        ticketRepository: new FakeTicketRepository([malformedTicket]),
        notificationRepository,
        settingsRepository: unusedSettingsRepository,
        logger: false
      });
      apps.push(app);

      const list = await app.inject({ method: "GET", url: "/api/tickets" });
      expect(list.json().tickets).toEqual([]);
      expect(
        (await app.inject({ method: "GET", url: `/api/tickets/${malformedTicket.id}` })).statusCode
      ).toBe(404);
    }
  );

  it("allows authenticated users to access authenticated tickets and only the private owner or technicians to access private tickets", async () => {
    const app = buildApp({
      authRepository,
      ticketRepository: new FakeTicketRepository([authenticatedTicket, privateTicket]),
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/tickets/${authenticatedTicket.id}`,
          headers: { cookie: "betterticket_session=user-session" }
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/tickets/${privateTicket.id}`,
          headers: { cookie: "betterticket_session=user-session" }
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/tickets/${privateTicket.id}`,
          headers: { cookie: "betterticket_session=technician-session" }
        })
      ).statusCode
    ).toBe(200);

    const otherUserHeaders = { cookie: "betterticket_session=other-user-session" };
    const otherUserList = await app.inject({
      method: "GET",
      url: "/api/tickets",
      headers: otherUserHeaders
    });
    expect(otherUserList.json().tickets.map((ticket: Ticket) => ticket.id)).toEqual([
      authenticatedTicket.id
    ]);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/tickets/${privateTicket.id}`,
          headers: otherUserHeaders
        })
      ).statusCode
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/tickets/${privateTicket.id}/replies`,
          headers: otherUserHeaders
        })
      ).statusCode
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/tickets/${privateTicket.id}/replies`,
          headers: otherUserHeaders,
          payload: { body: "No access" }
        })
      ).statusCode
    ).toBe(404);
  });

  it("rejects restricted ticket creation without a session", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      payload: { title: "Private", description: "Details", setup: "Setup", visibility: "PRIVATE" }
    });

    expect(response.statusCode).toBe(401);
    expect(repository.created).toHaveLength(0);
  });

  it("protects private replies with the same owner and technician rule", async () => {
    const repository = new FakeTicketRepository([privateTicket]);
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const anonymousReply = await app.inject({
      method: "POST",
      url: `/api/tickets/${privateTicket.id}/replies`,
      payload: { body: "No access" }
    });
    const ownerReply = await app.inject({
      method: "POST",
      url: `/api/tickets/${privateTicket.id}/replies`,
      headers: { cookie: "betterticket_session=user-session" },
      payload: { body: "I can reply" }
    });

    expect(anonymousReply.statusCode).toBe(404);
    expect(ownerReply.statusCode).toBe(201);
  });
});

describe("GET /api/tickets/:id", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];
  const storedTicket: TicketRecord = {
    id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
    title: "Laptop will not start",
    description: "The power light flashes once.",
    setup: "Framework Laptop 13, Fedora 42",
    additionalInformation: null,
    status: "OPEN",
    priority: "MEDIUM",
    visibility: "PUBLIC",
    creatorUserId: null,
    assignedTechnicianId: null,
    createdByName: null,
    createdAt: new Date("2026-09-28T18:00:00.000Z"),
    updatedAt: new Date("2026-09-28T18:00:00.000Z")
  };

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("returns the stored ticket without signing in", async () => {
    const app = buildApp({
      authRepository,
      ticketRepository: new FakeTicketRepository([storedTicket]),
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: `/api/tickets/${storedTicket.id}` });

    expect(response.statusCode).toBe(200);
    const { creatorUserId, ...publicTicketResponse } = storedTicket;
    expect(creatorUserId).toBeNull();
    expect(response.json()).toEqual({
      ...publicTicketResponse,
      replyStatus: "OPEN",
      canManageReplyStatus: false,
      canReply: true,
      createdAt: "2026-09-28T18:00:00.000Z",
      updatedAt: "2026-09-28T18:00:00.000Z"
    });
  });

  it("returns a stable error when the ticket does not exist", async () => {
    const app = buildApp({
      authRepository,
      ticketRepository: new FakeTicketRepository(),
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: `/api/tickets/${storedTicket.id}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "The ticket was not found"
      }
    });
  });

  it("rejects a malformed ticket ID without querying", async () => {
    const repository: TicketRepository = {
      create: vi.fn(),
      listRecent: vi.fn(),
      findById: vi.fn(),
      createReply: vi.fn(),
      listRecentReplies: vi.fn(),
      listTicketVotes: vi.fn(),
      getTicketVote: vi.fn(),
      setTicketVote: vi.fn(),
      setReplyVote: vi.fn(),
      assignTechnician: vi.fn(),
      updateStatus: vi.fn(),
      endorseReply: vi.fn(),
      withdrawEndorsement: vi.fn()
    };
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/tickets/not-a-uuid" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it("does not expose persistence errors", async () => {
    const repository: TicketRepository = {
      create: vi.fn(),
      listRecent: vi.fn(),
      findById: vi.fn().mockRejectedValue(new Error("password=database-secret")),
      createReply: vi.fn(),
      listRecentReplies: vi.fn(),
      listTicketVotes: vi.fn(),
      getTicketVote: vi.fn(),
      setTicketVote: vi.fn(),
      setReplyVote: vi.fn(),
      assignTechnician: vi.fn(),
      updateStatus: vi.fn(),
      endorseReply: vi.fn(),
      withdrawEndorsement: vi.fn()
    };
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: `/api/tickets/${storedTicket.id}` });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("database-secret");
    expect(response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "The ticket request could not be completed"
      }
    });
  });
});

describe("PATCH /api/tickets/:ticketId/assignment", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function buildAssignmentApp(
    result: AssignmentResult,
    sessionRepository: AuthRepository = authRepository
  ) {
    const repository: TicketRepository = {
      create: vi.fn(),
      listRecent: vi.fn(),
      findById: vi.fn(),
      createReply: vi.fn(),
      listRecentReplies: vi.fn(),
      listTicketVotes: vi.fn(),
      getTicketVote: vi.fn(),
      setTicketVote: vi.fn(),
      setReplyVote: vi.fn(),
      assignTechnician: vi.fn().mockResolvedValue(result),
      updateStatus: vi.fn(),
      endorseReply: vi.fn(),
      withdrawEndorsement: vi.fn()
    };
    const app = buildApp({
      authRepository: sessionRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);
    return { app, repository };
  }

  it("requires a valid session", async () => {
    const { app, repository } = buildAssignmentApp({ type: "ticket-not-found" });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/assignment`,
      payload: { assignedTechnicianId: technicianId }
    });

    expect(response.statusCode).toBe(401);
    expect(repository.assignTechnician).not.toHaveBeenCalled();
  });

  it("rejects authenticated regular users", async () => {
    const { app, repository } = buildAssignmentApp({ type: "ticket-not-found" });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/assignment`,
      headers: { cookie: "betterticket_session=user-session" },
      payload: { assignedTechnicianId: technicianId }
    });

    expect(response.statusCode).toBe(403);
    expect(repository.assignTechnician).not.toHaveBeenCalled();
  });

  it("rejects a technician session after the account is demoted", async () => {
    const sessionRepository = new FakeAuthRepository();
    const { app, repository } = buildAssignmentApp({ type: "ticket-not-found" }, sessionRepository);
    await sessionRepository.setUserRole("terry", "USER");

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/assignment`,
      headers: { cookie: "betterticket_session=technician-session" },
      payload: { assignedTechnicianId: null }
    });

    expect(response.statusCode).toBe(403);
    expect(repository.assignTechnician).not.toHaveBeenCalled();
  });

  it.each([
    ["assigns or reassigns", technicianId],
    ["unassigns", null]
  ])("%s a ticket without changing status", async (_name, assignedTechnicianId) => {
    const updatedAt = new Date("2026-10-05T18:00:00.000Z");
    const ticket: TicketRecord = {
      id: ticketId,
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42",
      additionalInformation: null,
      status: "OPEN",
      priority: "MEDIUM",
      visibility: "PUBLIC",
      creatorUserId: null,
      assignedTechnicianId,
      createdByName: null,
      createdAt: new Date("2026-09-28T18:00:00.000Z"),
      updatedAt
    };
    const { app, repository } = buildAssignmentApp({ type: "updated", ticket });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/assignment`,
      headers: { cookie: "betterticket_session=technician-session" },
      payload: { assignedTechnicianId }
    });

    expect(response.statusCode).toBe(200);
    expect(repository.assignTechnician).toHaveBeenCalledWith(ticketId, assignedTechnicianId);
    expect(response.json()).toMatchObject({ assignedTechnicianId, status: "OPEN" });
  });

  it("rejects a selected user who is not a technician", async () => {
    const { app } = buildAssignmentApp({ type: "invalid-technician" });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/assignment`,
      headers: { cookie: "betterticket_session=technician-session" },
      payload: { assignedTechnicianId: "bb97588e-0e8b-49e1-980b-4b9207121898" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: "INVALID_TECHNICIAN", message: "The selected technician is invalid" }
    });
  });

  it("returns not found for an unknown ticket", async () => {
    const { app } = buildAssignmentApp({ type: "ticket-not-found" });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/assignment`,
      headers: { cookie: "betterticket_session=technician-session" },
      payload: { assignedTechnicianId: null }
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("PATCH /api/tickets/:ticketId/status", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];
  const updatedTicket: TicketRecord = {
    id: ticketId,
    title: "Laptop will not start",
    description: "The power light flashes once.",
    setup: "Framework Laptop 13, Fedora 42",
    additionalInformation: null,
    status: "UNDER_REVIEW",
    priority: "MEDIUM",
    visibility: "PUBLIC",
    creatorUserId: null,
    assignedTechnicianId: null,
    createdByName: null,
    createdAt: new Date("2026-09-28T18:00:00.000Z"),
    updatedAt: new Date("2026-10-08T18:00:00.000Z")
  };

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function buildStatusApp(
    result: StatusUpdateResult,
    sessionRepository: AuthRepository = authRepository
  ) {
    const repository: TicketRepository = {
      create: vi.fn(),
      listRecent: vi.fn(),
      findById: vi.fn(),
      createReply: vi.fn(),
      listRecentReplies: vi.fn(),
      listTicketVotes: vi.fn(),
      getTicketVote: vi.fn(),
      setTicketVote: vi.fn(),
      setReplyVote: vi.fn(),
      assignTechnician: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue(result),
      endorseReply: vi.fn(),
      withdrawEndorsement: vi.fn()
    };
    const app = buildApp({
      authRepository: sessionRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);
    return { app, repository };
  }

  it("requires a valid session", async () => {
    const { app, repository } = buildStatusApp({ type: "ticket-not-found" });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/status`,
      payload: { status: "UNDER_REVIEW" }
    });

    expect(response.statusCode).toBe(401);
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it("rejects authenticated regular users", async () => {
    const { app, repository } = buildStatusApp({ type: "ticket-not-found" });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/status`,
      headers: { cookie: "betterticket_session=user-session" },
      payload: { status: "UNDER_REVIEW" }
    });

    expect(response.statusCode).toBe(403);
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it("rejects a technician session after the account is demoted", async () => {
    const sessionRepository = new FakeAuthRepository();
    const { app, repository } = buildStatusApp({ type: "ticket-not-found" }, sessionRepository);
    await sessionRepository.setUserRole("terry", "USER");

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/status`,
      headers: { cookie: "betterticket_session=technician-session" },
      payload: { status: "UNDER_REVIEW" }
    });

    expect(response.statusCode).toBe(403);
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it("allows a technician to update status and returns the ticket contract", async () => {
    const { app, repository } = buildStatusApp({ type: "updated", ticket: updatedTicket });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/status`,
      headers: { cookie: "betterticket_session=technician-session" },
      payload: { status: "UNDER_REVIEW" }
    });

    expect(response.statusCode).toBe(200);
    expect(repository.updateStatus).toHaveBeenCalledWith(ticketId, "UNDER_REVIEW", technicianId);
    expect(response.json()).toMatchObject({ status: "UNDER_REVIEW" });
  });

  it("returns an unchanged ticket for an idempotent status update", async () => {
    const { app, repository } = buildStatusApp({ type: "unchanged", ticket: updatedTicket });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/status`,
      headers: { cookie: "betterticket_session=technician-session" },
      payload: { status: "UNDER_REVIEW" }
    });

    expect(response.statusCode).toBe(200);
    expect(repository.updateStatus).toHaveBeenCalledWith(ticketId, "UNDER_REVIEW", technicianId);
    expect(response.json()).toMatchObject({ status: "UNDER_REVIEW" });
  });

  it("returns a stable error for an invalid transition", async () => {
    const { app } = buildStatusApp({ type: "invalid-transition" });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/status`,
      headers: { cookie: "betterticket_session=technician-session" },
      payload: { status: "RESOLVED" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: "Technicians can only advance a ticket one stage, up to resolved"
      }
    });
  });

  it("returns not found for an unknown ticket", async () => {
    const { app } = buildStatusApp({ type: "ticket-not-found" });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tickets/${ticketId}/status`,
      headers: { cookie: "betterticket_session=technician-session" },
      payload: { status: "UNDER_REVIEW" }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "The ticket was not found" }
    });
  });

  it.each([{ status: "CLOSED" }, { status: "UNDER_REVIEW", extra: true }, {}])(
    "rejects invalid request bodies: %j",
    async (payload) => {
      const { app, repository } = buildStatusApp({ type: "updated", ticket: updatedTicket });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/tickets/${ticketId}/status`,
        headers: { cookie: "betterticket_session=technician-session" },
        payload
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
      expect(repository.updateStatus).not.toHaveBeenCalled();
    }
  );
});

describe("canTechnicianChangeStatus", () => {
  it.each([
    ["OPEN", "UNDER_REVIEW", true],
    ["UNDER_REVIEW", "IN_PROGRESS", true],
    ["IN_PROGRESS", "RESOLVED", true],
    ["OPEN", "RESOLVED", false],
    ["IN_PROGRESS", "IN_PROGRESS", false],
    ["RESOLVED", "IN_PROGRESS", false],
    ["RESOLVED", "COMPLETED", false],
    ["OPEN", "COMPLETED", false]
  ] as const)("%s → %s is %s", (from, to, allowed) => {
    expect(canTechnicianChangeStatus(from, to)).toBe(allowed);
  });
});

describe("ticket replies", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];
  const storedTicket: TicketRecord = {
    id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
    title: "Laptop will not start",
    description: "The power light flashes once.",
    setup: "Framework Laptop 13, Fedora 42",
    additionalInformation: null,
    status: "OPEN",
    priority: "MEDIUM",
    visibility: "PUBLIC",
    creatorUserId: null,
    assignedTechnicianId: null,
    createdByName: null,
    createdAt: new Date("2026-09-28T18:00:00.000Z"),
    updatedAt: new Date("2026-09-28T18:00:00.000Z")
  };
  const storedReply: ReplyRecord = {
    id: "0b9d7c58-0a55-4d0c-8a44-0d3f5f3f9a01",
    ticketId: storedTicket.id,
    kind: "COMMENT",
    body: "Have you tried a different charger?",
    upvotes: 0,
    downvotes: 0,
    userVote: null,
    createdAt: new Date("2026-09-29T09:30:00.000Z"),
    endorsements: []
  };
  const repliesUrl = `/api/tickets/${storedTicket.id}/replies`;

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function build(repository: TicketRepository) {
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    return app;
  }

  describe("GET /api/tickets/:id/replies", () => {
    it("returns the ticket's replies in repository order without signing in", async () => {
      const repository = new FakeTicketRepository([storedTicket], [storedReply]);

      const response = await build(repository).inject({ method: "GET", url: repliesUrl });

      expect(response.statusCode).toBe(200);
      expect(repository.replyListLimits).toEqual([200]);
      expect(response.json()).toEqual({
        replies: [{ ...storedReply, createdAt: "2026-09-29T09:30:00.000Z" }]
      });
    });

    it("returns an empty list when the ticket has no replies", async () => {
      const response = await build(new FakeTicketRepository([storedTicket])).inject({
        method: "GET",
        url: repliesUrl
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ replies: [] });
    });

    it("returns a stable error when the ticket does not exist", async () => {
      const repository = new FakeTicketRepository();

      const response = await build(repository).inject({ method: "GET", url: repliesUrl });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: { code: "NOT_FOUND", message: "The ticket was not found" }
      });
      expect(repository.replyListLimits).toEqual([]);
    });

    it("rejects a malformed ticket ID without querying", async () => {
      const repository: TicketRepository = {
        create: vi.fn(),
        listRecent: vi.fn(),
        findById: vi.fn(),
        createReply: vi.fn(),
        listRecentReplies: vi.fn(),
        listTicketVotes: vi.fn(),
        getTicketVote: vi.fn(),
        setTicketVote: vi.fn(),
        setReplyVote: vi.fn(),
        assignTechnician: vi.fn(),
        updateStatus: vi.fn(),
        endorseReply: vi.fn(),
        withdrawEndorsement: vi.fn()
      };

      const response = await build(repository).inject({
        method: "GET",
        url: "/api/tickets/not-a-uuid/replies"
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
      expect(repository.findById).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/tickets/:id/replies", () => {
    it("creates an anonymous reply with a trimmed body", async () => {
      const repository = new FakeTicketRepository([storedTicket]);

      const response = await build(repository).inject({
        method: "POST",
        url: repliesUrl,
        payload: { body: "  Yes, same result with a second charger.  " }
      });

      expect(response.statusCode).toBe(201);
      expect(repository.createdReplies).toEqual([
        {
          ticketId: storedTicket.id,
          body: "Yes, same result with a second charger.",
          kind: "COMMENT"
        }
      ]);
      expect(response.json()).toEqual({
        id: "5d4c1f0e-6f0a-4a57-9d0b-3a0b6a1f2c11",
        ticketId: storedTicket.id,
        kind: "COMMENT",
        body: "Yes, same result with a second charger.",
        upvotes: 0,
        downvotes: 0,
        userVote: null,
        createdAt: "2026-10-07T18:00:00.000Z",
        endorsements: []
      });
    });

    it("stores a suggested solution when the kind is given", async () => {
      const repository = new FakeTicketRepository([storedTicket]);

      const response = await build(repository).inject({
        method: "POST",
        url: repliesUrl,
        payload: { body: "Reinstall the driver.", kind: "SOLUTION" }
      });

      expect(response.statusCode).toBe(201);
      expect(repository.createdReplies).toEqual([
        { ticketId: storedTicket.id, body: "Reinstall the driver.", kind: "SOLUTION" }
      ]);
      expect(response.json()).toMatchObject({ kind: "SOLUTION", endorsements: [] });
    });

    it("returns the stable closed-ticket conflict for a typed reply", async () => {
      const repository = new FakeTicketRepository([{ ...storedTicket, replyStatus: "CLOSED" }]);
      repository.replyCreationFailure = { type: "ticket-closed" };

      const response = await build(repository).inject({
        method: "POST",
        url: repliesUrl,
        payload: { body: "Reinstall the driver.", kind: "SOLUTION" }
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: { code: "TICKET_CLOSED", message: "This ticket is closed to new replies" }
      });
    });

    it.each([
      ["a missing body", {}],
      ["a blank body", { body: "   " }],
      ["an oversized body", { body: "a".repeat(5_001) }],
      ["an unknown field", { body: "Reply", author: "Technician" }],
      ["an unknown kind", { body: "Reply", kind: "ANSWER" }]
    ])("rejects %s", async (_name, payload) => {
      const repository = new FakeTicketRepository([storedTicket]);

      const response = await build(repository).inject({
        method: "POST",
        url: repliesUrl,
        payload
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
      expect(repository.createdReplies).toEqual([]);
    });

    it("does not store a reply for a ticket that does not exist", async () => {
      const repository = new FakeTicketRepository();

      const response = await build(repository).inject({
        method: "POST",
        url: repliesUrl,
        payload: { body: "Reply" }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: { code: "NOT_FOUND", message: "The ticket was not found" }
      });
      expect(repository.createdReplies).toEqual([]);
    });

    it("does not expose persistence errors", async () => {
      const repository: TicketRepository = {
        create: vi.fn(),
        listRecent: vi.fn(),
        findById: vi.fn().mockResolvedValue(storedTicket),
        createReply: vi.fn().mockRejectedValue(new Error("password=database-secret")),
        listRecentReplies: vi.fn(),
        listTicketVotes: vi.fn(),
        getTicketVote: vi.fn(),
        setTicketVote: vi.fn(),
        setReplyVote: vi.fn(),
        assignTechnician: vi.fn(),
        updateStatus: vi.fn(),
        endorseReply: vi.fn(),
        withdrawEndorsement: vi.fn()
      };

      const response = await build(repository).inject({
        method: "POST",
        url: repliesUrl,
        payload: { body: "Reply" }
      });

      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain("database-secret");
      expect(response.json()).toEqual({
        error: { code: "INTERNAL_ERROR", message: "The ticket request could not be completed" }
      });
    });
  });
});

describe("reply endorsements", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];
  const replyId = "0b9d7c58-0a55-4d0c-8a44-0d3f5f3f9a01";
  const storedTicket: TicketRecord = {
    id: ticketId,
    title: "Printer offline",
    description: "The lab printer shows offline.",
    setup: "HP LaserJet, Windows 11",
    additionalInformation: null,
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    visibility: "PUBLIC",
    creatorUserId: null,
    assignedTechnicianId: null,
    createdByName: null,
    createdAt: new Date("2026-10-28T18:00:00.000Z"),
    updatedAt: new Date("2026-10-28T18:00:00.000Z")
  };
  const endorsedReply: ReplyRecord = {
    id: replyId,
    ticketId,
    kind: "SOLUTION",
    body: "Reinstall the driver.",
    createdAt: new Date("2026-10-28T18:30:00.000Z"),
    upvotes: 0,
    downvotes: 0,
    userVote: null,
    endorsements: [
      {
        id: "a1b2c3d4-0000-4000-8000-000000000001",
        technicianId,
        technicianName: "Terry Technician",
        notes: "Use v4.2.",
        createdAt: new Date("2026-10-28T19:00:00.000Z"),
        updatedAt: new Date("2026-10-28T19:00:00.000Z")
      },
      {
        id: "a1b2c3d4-0000-4000-8000-000000000002",
        technicianId: "f0f0f0f0-0000-4000-8000-000000000003",
        technicianName: "Pat Other",
        notes: null,
        createdAt: new Date("2026-10-28T19:05:00.000Z"),
        updatedAt: new Date("2026-10-28T19:05:00.000Z")
      }
    ]
  };
  const endorsementUrl = `/api/tickets/${ticketId}/replies/${replyId}/endorsement`;
  const technicianCookie = { cookie: "betterticket_session=technician-session" };

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function build(repository: TicketRepository) {
    const app = buildApp({
      authRepository,
      ticketRepository: repository,
      notificationRepository,
      settingsRepository: unusedSettingsRepository,
      logger: false
    });
    apps.push(app);

    return app;
  }

  describe("PUT /api/tickets/:ticketId/replies/:replyId/endorsement", () => {
    it("endorses with trimmed notes and returns the reply and ticket without user IDs", async () => {
      const repository = new FakeTicketRepository([storedTicket]);
      repository.endorseResult = {
        type: "endorsed",
        reply: endorsedReply,
        ticket: { ...storedTicket, status: "RESOLVED" }
      };

      const response = await build(repository).inject({
        method: "PUT",
        url: endorsementUrl,
        headers: technicianCookie,
        payload: { notes: "  Use v4.2.  ", markResolved: true }
      });

      expect(response.statusCode).toBe(200);
      expect(repository.endorsements).toEqual([
        { ticketId, replyId, technicianId, input: { notes: "Use v4.2.", markResolved: true } }
      ]);
      expect(response.json().reply).toEqual({
        id: replyId,
        ticketId,
        kind: "SOLUTION",
        body: "Reinstall the driver.",
        createdAt: "2026-10-28T18:30:00.000Z",
        upvotes: 0,
        downvotes: 0,
        userVote: null,
        endorsements: [
          {
            id: "a1b2c3d4-0000-4000-8000-000000000001",
            technicianName: "Terry Technician",
            notes: "Use v4.2.",
            createdAt: "2026-10-28T19:00:00.000Z",
            updatedAt: "2026-10-28T19:00:00.000Z",
            isOwn: true
          },
          {
            id: "a1b2c3d4-0000-4000-8000-000000000002",
            technicianName: "Pat Other",
            notes: null,
            createdAt: "2026-10-28T19:05:00.000Z",
            updatedAt: "2026-10-28T19:05:00.000Z",
            isOwn: false
          }
        ]
      });
      expect(response.json().ticket).toMatchObject({ id: ticketId, status: "RESOLVED" });
      expect(response.body).not.toContain(technicianId);
    });

    it.each([
      ["missing notes", {}],
      ["blank notes", { notes: "   " }]
    ])("stores %s as null without resolving", async (_name, payload) => {
      const repository = new FakeTicketRepository([storedTicket]);
      repository.endorseResult = { type: "endorsed", reply: endorsedReply, ticket: storedTicket };

      const response = await build(repository).inject({
        method: "PUT",
        url: endorsementUrl,
        headers: technicianCookie,
        payload
      });

      expect(response.statusCode).toBe(200);
      expect(repository.endorsements[0]?.input).toEqual({ notes: null, markResolved: false });
    });

    it.each([
      ["no session", {}, 401, "AUTHENTICATION_REQUIRED"],
      ["a regular user", { cookie: "betterticket_session=user-session" }, 403, "FORBIDDEN"]
    ])("rejects %s without writing", async (_name, headers, statusCode, code) => {
      const repository = new FakeTicketRepository([storedTicket]);

      const response = await build(repository).inject({
        method: "PUT",
        url: endorsementUrl,
        headers,
        payload: {}
      });

      expect(response.statusCode).toBe(statusCode);
      expect(response.json()).toMatchObject({ error: { code } });
      expect(repository.endorsements).toEqual([]);
    });

    it.each([
      ["oversized notes", { notes: "a".repeat(2_001) }],
      ["an unknown field", { notes: "ok", technicianId }],
      ["a non-boolean markResolved", { markResolved: "yes" }]
    ])("rejects %s", async (_name, payload) => {
      const repository = new FakeTicketRepository([storedTicket]);

      const response = await build(repository).inject({
        method: "PUT",
        url: endorsementUrl,
        headers: technicianCookie,
        payload
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
      expect(repository.endorsements).toEqual([]);
    });

    it("rejects a malformed reply ID", async () => {
      const repository = new FakeTicketRepository([storedTicket]);

      const response = await build(repository).inject({
        method: "PUT",
        url: `/api/tickets/${ticketId}/replies/not-a-uuid/endorsement`,
        headers: technicianCookie,
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      expect(repository.endorsements).toEqual([]);
    });

    it("returns not found for a missing ticket without writing", async () => {
      const repository = new FakeTicketRepository();

      const response = await build(repository).inject({
        method: "PUT",
        url: endorsementUrl,
        headers: technicianCookie,
        payload: {}
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: { code: "NOT_FOUND", message: "The ticket was not found" }
      });
      expect(repository.endorsements).toEqual([]);
    });

    it.each([
      [
        { type: "reply-not-found" } as const,
        404,
        { code: "NOT_FOUND", message: "The reply was not found" }
      ],
      [
        { type: "not-a-solution" } as const,
        400,
        { code: "NOT_A_SOLUTION", message: "Only suggested solutions can be endorsed" }
      ],
      [
        { type: "invalid-transition" } as const,
        400,
        {
          code: "INVALID_STATUS_TRANSITION",
          message: "Only an in-progress ticket can be marked resolved"
        }
      ]
    ])("maps the %o result", async (result, statusCode, error) => {
      const repository = new FakeTicketRepository([storedTicket]);
      repository.endorseResult = result;

      const response = await build(repository).inject({
        method: "PUT",
        url: endorsementUrl,
        headers: technicianCookie,
        payload: { markResolved: true }
      });

      expect(response.statusCode).toBe(statusCode);
      expect(response.json()).toEqual({ error });
    });
  });

  describe("DELETE /api/tickets/:ticketId/replies/:replyId/endorsement", () => {
    it("withdraws the caller's own endorsement", async () => {
      const repository = new FakeTicketRepository([storedTicket]);
      repository.withdrawResult = { type: "withdrawn" };

      const response = await build(repository).inject({
        method: "DELETE",
        url: endorsementUrl,
        headers: technicianCookie
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
      expect(repository.withdrawals).toEqual([{ ticketId, replyId, technicianId }]);
    });

    it("returns not found when the caller has no endorsement", async () => {
      const repository = new FakeTicketRepository([storedTicket]);

      const response = await build(repository).inject({
        method: "DELETE",
        url: endorsementUrl,
        headers: technicianCookie
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: { code: "NOT_FOUND", message: "The endorsement was not found" }
      });
    });

    it("returns not found for a missing ticket", async () => {
      const repository = new FakeTicketRepository();

      const response = await build(repository).inject({
        method: "DELETE",
        url: endorsementUrl,
        headers: technicianCookie
      });

      expect(response.statusCode).toBe(404);
      expect(repository.withdrawals).toEqual([]);
    });

    it.each([
      ["no session", {}, 401],
      ["a regular user", { cookie: "betterticket_session=user-session" }, 403]
    ])("rejects %s without writing", async (_name, headers, statusCode) => {
      const repository = new FakeTicketRepository([storedTicket]);

      const response = await build(repository).inject({
        method: "DELETE",
        url: endorsementUrl,
        headers
      });

      expect(response.statusCode).toBe(statusCode);
      expect(repository.withdrawals).toEqual([]);
    });
  });

  describe("ticket visibility", () => {
    const otherUserId = "cc086f3d-2c21-4c63-a4d4-5a5d0d3e7b9c";

    it.each(["AUTHENTICATED", "PRIVATE"] as const)(
      "lets a technician endorse and withdraw on a %s ticket they did not create",
      async (visibility) => {
        const ticket = { ...storedTicket, visibility, creatorUserId: otherUserId };
        const repository = new FakeTicketRepository([ticket]);
        repository.endorseResult = { type: "endorsed", reply: endorsedReply, ticket };
        repository.withdrawResult = { type: "withdrawn" };
        const app = build(repository);

        const endorsed = await app.inject({
          method: "PUT",
          url: endorsementUrl,
          headers: technicianCookie,
          payload: {}
        });
        const withdrawn = await app.inject({
          method: "DELETE",
          url: endorsementUrl,
          headers: technicianCookie
        });

        expect(endorsed.statusCode).toBe(200);
        expect(withdrawn.statusCode).toBe(204);
      }
    );

    it("does not reveal a private ticket to a regular user", async () => {
      const ticket = {
        ...storedTicket,
        visibility: "PRIVATE" as const,
        creatorUserId: otherUserId
      };
      const repository = new FakeTicketRepository([ticket]);
      const app = build(repository);
      const request = {
        method: "PUT" as const,
        headers: { cookie: "betterticket_session=user-session" },
        payload: {}
      };

      const existing = await app.inject({ ...request, url: endorsementUrl });
      const missing = await app.inject({
        ...request,
        url: `/api/tickets/00000000-0000-4000-8000-000000000000/replies/${replyId}/endorsement`
      });

      expect(existing.statusCode).toBe(403);
      expect(existing.json()).toEqual(missing.json());
      expect(repository.endorsements).toEqual([]);
    });
  });

  it("lists endorsements with isOwn computed for the current viewer", async () => {
    const repository = new FakeTicketRepository([storedTicket], [endorsedReply]);
    const app = build(repository);

    const asTechnician = await app.inject({
      method: "GET",
      url: `/api/tickets/${ticketId}/replies`,
      headers: technicianCookie
    });
    const asVisitor = await app.inject({ method: "GET", url: `/api/tickets/${ticketId}/replies` });

    const ownFlags = (body: { replies: Array<{ endorsements: Array<{ isOwn: boolean }> }> }) =>
      body.replies[0]?.endorsements.map((endorsement) => endorsement.isOwn);
    expect(ownFlags(asTechnician.json())).toEqual([true, false]);
    expect(ownFlags(asVisitor.json())).toEqual([false, false]);
    expect(asVisitor.body).not.toContain(technicianId);
  });
});
