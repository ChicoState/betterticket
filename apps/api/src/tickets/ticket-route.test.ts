import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import type { CreateTicketInput, TicketRecord, TicketRepository } from "./ticket-repository.js";

class FakeTicketRepository implements TicketRepository {
  readonly created: CreateTicketInput[] = [];

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
      create: vi.fn().mockRejectedValue(new Error("password=database-secret"))
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
        message: "The ticket could not be created"
      }
    });
  });
});
