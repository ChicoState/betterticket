import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import type { AuthenticatedUser, CreateUserInput, LoginInput } from "./auth-contract.js";
import type { AuthRepository, CreatedSession } from "./auth-repository.js";
import type {
  AssignmentResult,
  TicketRecord,
  TicketRepository
} from "../tickets/ticket-repository.js";

const technician: AuthenticatedUser = {
  id: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
  name: "Terry Technician",
  username: "terry",
  role: "TECHNICIAN"
};

class FakeAuthRepository implements AuthRepository {
  readonly sessions = new Map<string, AuthenticatedUser>();
  createdUser: CreateUserInput | undefined;

  async createSession(input: LoginInput): Promise<CreatedSession | null> {
    if (input.username !== "terry" || input.password !== "correct horse battery staple") {
      return null;
    }

    const token = "test-session-token";
    this.sessions.set(token, technician);
    return { token, user: technician };
  }

  async findUserBySession(token: string): Promise<AuthenticatedUser | null> {
    return this.sessions.get(token) ?? null;
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async createUser(input: CreateUserInput): Promise<AuthenticatedUser | null> {
    this.createdUser = input;
    if (input.username.trim().toLowerCase() === "taken") {
      return null;
    }

    return {
      id: "bb04d84c-9aee-4d35-8af3-999d861aaed6",
      name: input.name.trim(),
      username: input.username.trim().toLowerCase(),
      role: input.role
    };
  }
}

const unusedTicketRepository: TicketRepository = {
  create: async (): Promise<TicketRecord> => {
    throw new Error("not used");
  },
  listRecent: async (): Promise<TicketRecord[]> => {
    throw new Error("not used");
  },
  findById: async (): Promise<TicketRecord | null> => {
    throw new Error("not used");
  },
  assignTechnician: async (): Promise<AssignmentResult> => {
    throw new Error("not used");
  }
};

describe("session routes", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("logs in with valid credentials and sets a protected session cookie", async () => {
    const authRepository = new FakeAuthRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: unusedTicketRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { username: "  TERRY  ", password: "correct horse battery staple" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(technician);
    expect(response.headers["set-cookie"]).toContain("betterticket_session=test-session-token");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Strict");
    expect(response.body).not.toContain("password");
  });

  it("returns the same generic error for invalid credentials", async () => {
    const app = buildApp({
      authRepository: new FakeAuthRepository(),
      ticketRepository: unusedTicketRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { username: "unknown", password: "incorrect password" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "Username or password is incorrect" }
    });
  });

  it("revokes the current session and clears its cookie", async () => {
    const authRepository = new FakeAuthRepository();
    authRepository.sessions.set("test-session-token", technician);
    const app = buildApp({
      authRepository,
      ticketRepository: unusedTicketRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "DELETE",
      url: "/api/sessions/current",
      headers: { cookie: "betterticket_session=test-session-token" }
    });

    expect(response.statusCode).toBe(204);
    expect(authRepository.sessions.size).toBe(0);
    expect(response.headers["set-cookie"]).toContain("betterticket_session=");
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");
  });

  it("does not expose authentication persistence errors", async () => {
    const authRepository = new FakeAuthRepository();
    authRepository.createSession = async () => {
      throw new Error("password=database-secret");
    };
    const app = buildApp({
      authRepository,
      ticketRepository: unusedTicketRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { username: "terry", password: "correct horse battery staple" }
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("database-secret");
    expect(response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed" }
    });
  });

  it("rate limits repeated login attempts", async () => {
    const app = buildApp({
      authRepository: new FakeAuthRepository(),
      ticketRepository: unusedTicketRepository,
      logger: false
    });
    apps.push(app);

    let response;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await app.inject({
        method: "POST",
        url: "/api/sessions",
        payload: { username: "unknown", password: "incorrect password" }
      });
    }

    expect(response?.statusCode).toBe(429);
    expect(response?.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "Too many login attempts" }
    });
  });
});

describe("public user registration", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("creates only a regular user without setting a session", async () => {
    const authRepository = new FakeAuthRepository();
    const app = buildApp({
      authRepository,
      ticketRepository: unusedTicketRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: {
        name: "  Uma User  ",
        username: "  UMA  ",
        password: "correct horse battery staple"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: "bb04d84c-9aee-4d35-8af3-999d861aaed6",
      name: "Uma User",
      username: "uma",
      role: "USER"
    });
    expect(authRepository.createdUser).toEqual({
      name: "  Uma User  ",
      username: "  UMA  ",
      password: "correct horse battery staple",
      role: "USER"
    });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects a role supplied by the browser", async () => {
    const app = buildApp({
      authRepository: new FakeAuthRepository(),
      ticketRepository: unusedTicketRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: {
        name: "Uma User",
        username: "uma",
        password: "correct horse battery staple",
        role: "TECHNICIAN"
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("reports a duplicate username without exposing internal errors", async () => {
    const app = buildApp({
      authRepository: new FakeAuthRepository(),
      ticketRepository: unusedTicketRepository,
      logger: false
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "Uma User", username: "taken", password: "correct horse battery staple" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: { code: "USERNAME_UNAVAILABLE", message: "That username is unavailable" }
    });
  });

  it("rate limits registration attempts", async () => {
    const app = buildApp({
      authRepository: new FakeAuthRepository(),
      ticketRepository: unusedTicketRepository,
      logger: false
    });
    apps.push(app);

    let response;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await app.inject({
        method: "POST",
        url: "/api/users",
        payload: {
          name: "Uma User",
          username: `uma-${attempt}`,
          password: "correct horse battery staple"
        }
      });
    }

    expect(response?.statusCode).toBe(429);
    expect(response?.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "Too many account-creation attempts" }
    });
  });
});
