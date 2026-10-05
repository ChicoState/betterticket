import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import type { CreateTicketInput, TicketRecord, TicketRepository } from "./ticket-repository.js";

class FakeTicketRepository implements TicketRepository {
  readonly created: CreateTicketInput[] = [];
  readonly listLimits: number[] = [];

  constructor(private readonly stored: TicketRecord[] = []) {}

  async create(input: CreateTicketInput): Promise<TicketRecord> {
    this.created.push(input);

    return {
      id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
      ...input,
      additionalInformation: input.additionalInformation ?? null,
      status: "OPEN",
      createdAt: new Date("2026-09-28T18:00:00.000Z"),
      updatedAt: new Date("2026-09-28T18:00:00.000Z")
    };
  }

  async listRecent(limit: number): Promise<TicketRecord[]> {
    this.listLimits.push(limit);

    return this.stored;
  }

  async findById(id: string): Promise<TicketRecord | null> {
    return this.stored.find((ticket) => ticket.id === id) ?? null;
  }
}

describe("POST /api/tickets", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("creates an anonymous ticket with normalized input", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({ ticketRepository: repository, logger: false });
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
    const app = buildApp({ ticketRepository: repository, logger: false });
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
    const app = buildApp({ ticketRepository: repository, logger: false });
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
      findById: vi.fn()
    };
    const app = buildApp({ ticketRepository: repository, logger: false });
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
        createdAt: new Date("2026-09-28T18:00:00.000Z"),
        updatedAt: new Date("2026-09-28T18:00:00.000Z")
      }
    ]);
    const app = buildApp({ ticketRepository: repository, logger: false });
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
          createdAt: "2026-09-29T09:30:00.000Z",
          updatedAt: "2026-09-29T09:30:00.000Z"
        },
        {
          id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
          title: "Laptop will not start",
          description: "The power light flashes once.",
          setup: "Framework Laptop 13, Fedora 42",
          additionalInformation: "Started after an update.",
          status: "OPEN",
          createdAt: "2026-09-28T18:00:00.000Z",
          updatedAt: "2026-09-28T18:00:00.000Z"
        }
      ]
    });
  });

  it("returns an empty list when no tickets exist", async () => {
    const app = buildApp({ ticketRepository: new FakeTicketRepository(), logger: false });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/api/tickets" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ tickets: [] });
  });

  it("does not expose persistence errors", async () => {
    const repository: TicketRepository = {
      create: vi.fn(),
      listRecent: vi.fn().mockRejectedValue(new Error("password=database-secret")),
      findById: vi.fn()
    };
    const app = buildApp({ ticketRepository: repository, logger: false });
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

describe("GET /api/tickets/:id", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];
  const storedTicket: TicketRecord = {
    id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
    title: "Laptop will not start",
    description: "The power light flashes once.",
    setup: "Framework Laptop 13, Fedora 42",
    additionalInformation: null,
    status: "OPEN",
    createdAt: new Date("2026-09-28T18:00:00.000Z"),
    updatedAt: new Date("2026-09-28T18:00:00.000Z")
  };

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("returns the stored ticket without signing in", async () => {
    const app = buildApp({
      ticketRepository: new FakeTicketRepository([storedTicket]),
      logger: false
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: `/api/tickets/${storedTicket.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...storedTicket,
      createdAt: "2026-09-28T18:00:00.000Z",
      updatedAt: "2026-09-28T18:00:00.000Z"
    });
  });

  it("returns a stable error when the ticket does not exist", async () => {
    const app = buildApp({ ticketRepository: new FakeTicketRepository(), logger: false });
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
      findById: vi.fn()
    };
    const app = buildApp({ ticketRepository: repository, logger: false });
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
      findById: vi.fn().mockRejectedValue(new Error("password=database-secret"))
    };
    const app = buildApp({ ticketRepository: repository, logger: false });
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
