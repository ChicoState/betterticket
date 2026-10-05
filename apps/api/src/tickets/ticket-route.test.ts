import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import type { CommentRepository } from "./comment-repository.js";
import type { NotificationRepository } from "../notifications/notification-repository.js";
import type { CreateTicketInput, TicketRecord, TicketRepository } from "./ticket-repository.js";

class FakeTicketRepository implements TicketRepository {
  readonly created: CreateTicketInput[] = [];

  async create(input: CreateTicketInput, ownerId: string): Promise<TicketRecord> {
    this.created.push(input);

    return {
      id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
      ...input,
      additionalInformation: input.additionalInformation ?? null,
      ownerId,
      solutionCommentId: null,
      status: "OPEN",
      createdAt: new Date("2026-09-28T18:00:00.000Z"),
      updatedAt: new Date("2026-09-28T18:00:00.000Z")
    };
  }

  async list(): Promise<TicketRecord[]> {
    return [];
  }
  async findById(): Promise<TicketRecord | null> {
    return null;
  }
  async setSolution(): Promise<TicketRecord | null> {
    return null;
  }
}

const commentRepository: CommentRepository = {
  list: async () => [],
  findById: async () => null,
  create: async () => {
    throw new Error("not used");
  },
  update: async () => null,
  softDelete: async () => null,
  setSpotlight: async () => null,
  toggleHelpful: async () => false,
  helpfulCount: async () => 0
};

const authRepository: AuthRepository = {
  findUserByEmail: async () => null,
  createUser: async () => {
    throw new Error("not used");
  },
  changePassword: async () => {},
  createSession: async () => {},
  deleteSession: async () => {},
  findSession: async () => ({
    user: {
      id: "6ec4b6a4-8ece-4f49-8a3a-8a1a0a000001",
      email: "user@example.com",
      role: "USER",
      mustChangePassword: false
    },
    csrfToken: "csrf"
  })
};

const notificationRepository: NotificationRepository = {
  isParticipant: async () => false,
  upsertPreference: async () => {},
  listForUser: async () => [],
  notifyParticipants: async () => {}
};

const sessionHeaders = { cookie: "bt_session=test", "x-csrf-token": "csrf" };

describe("POST /api/tickets", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("creates an owned ticket with normalized input", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      ticketRepository: repository,
      commentRepository,
      authRepository,
      notificationRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: sessionHeaders,
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
        additionalInformation: "Started after an update."
      }
    ]);
    expect(response.json()).toEqual({
      id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
      title: "Laptop will not start",
      description: "The power light flashes once.",
      setup: "Framework Laptop 13, Fedora 42",
      additionalInformation: "Started after an update.",
      ownerId: "6ec4b6a4-8ece-4f49-8a3a-8a1a0a000001",
      solutionCommentId: null,
      status: "OPEN",
      createdAt: "2026-09-28T18:00:00.000Z",
      updatedAt: "2026-09-28T18:00:00.000Z"
    });
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
    ["oversized description", { title: "Issue", description: "x".repeat(5_001), setup: "Setup" }]
  ])("rejects %s without writing", async (_name, payload) => {
    const repository = new FakeTicketRepository();
    const app = buildApp({
      ticketRepository: repository,
      commentRepository,
      authRepository,
      notificationRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: sessionHeaders,
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
      ticketRepository: repository,
      commentRepository,
      authRepository,
      notificationRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: sessionHeaders,
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
      list: vi.fn(),
      findById: vi.fn(),
      setSolution: vi.fn()
    };
    const app = buildApp({
      ticketRepository: repository,
      commentRepository,
      authRepository,
      notificationRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: sessionHeaders,
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
        message: "The request could not be completed"
      }
    });
  });
});
