import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import type { AuthenticatedUser } from "../auth/auth-contract.js";
import type { AuthRepository, CreatedSession } from "../auth/auth-repository.js";
import type {
  AssignmentResult,
  CreateTicketInput,
  TicketRecord,
  TicketRepository
} from "./ticket-repository.js";

const technicianId = "8d98734d-647b-4ae5-a9a3-59eb30c160a6";
const ticketId = "cc04d84c-9aee-4d35-8af3-999d861aaed6";

class FakeAuthRepository implements AuthRepository {
  async createSession(): Promise<CreatedSession | null> {
    throw new Error("not used");
  }

  async findUserBySession(token: string): Promise<AuthenticatedUser | null> {
    if (token === "technician-session") {
      return { id: technicianId, name: "Terry Technician", username: "terry", role: "TECHNICIAN" };
    }
    if (token === "user-session") {
      return {
        id: "bb97588e-0e8b-49e1-980b-4b9207121898",
        name: "Uma User",
        username: "uma",
        role: "USER"
      };
    }
    return null;
  }

  async deleteSession(): Promise<void> {
    throw new Error("not used");
  }

  async createUser(): Promise<AuthenticatedUser | null> {
    throw new Error("not used");
  }
}

const authRepository = new FakeAuthRepository();

class FakeTicketRepository implements TicketRepository {
  readonly created: CreateTicketInput[] = [];

  async create(input: CreateTicketInput): Promise<TicketRecord> {
    this.created.push(input);

    return {
      id: ticketId,
      ...input,
      additionalInformation: input.additionalInformation ?? null,
      status: "OPEN",
      assignedTechnicianId: null,
      createdAt: new Date("2026-09-28T18:00:00.000Z"),
      updatedAt: new Date("2026-09-28T18:00:00.000Z")
    };
  }

  async assignTechnician(): Promise<AssignmentResult> {
    throw new Error("not used");
  }
}

describe("POST /api/tickets", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("creates an anonymous ticket with normalized input", async () => {
    const repository = new FakeTicketRepository();
    const app = buildApp({ authRepository, ticketRepository: repository, logger: false });
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
      assignedTechnicianId: null,
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
    const app = buildApp({ authRepository, ticketRepository: repository, logger: false });
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
    const app = buildApp({ authRepository, ticketRepository: repository, logger: false });
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
      assignTechnician: vi.fn()
    };
    const app = buildApp({ authRepository, ticketRepository: repository, logger: false });
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

describe("PATCH /api/tickets/:ticketId/assignment", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function buildAssignmentApp(result: AssignmentResult) {
    const repository: TicketRepository = {
      create: vi.fn(),
      assignTechnician: vi.fn().mockResolvedValue(result)
    };
    const app = buildApp({ authRepository, ticketRepository: repository, logger: false });
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
      assignedTechnicianId,
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
