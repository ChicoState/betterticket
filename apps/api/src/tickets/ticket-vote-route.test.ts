import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionCookieName } from "../auth/auth-contract.js";
import { buildApp } from "../app.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import type { TicketRepository } from "./ticket-repository.js";

const ticketId = "cc04d84c-9aee-4d35-8af3-999d861aaed6";
const userId = "bb97588e-0e8b-49e1-980b-4b9207121898";
const url = `/api/tickets/${ticketId}/vote`;
const vote = { upvotes: 2, downvotes: 1, userVote: 1 };

function setup(role: "USER" | "TECHNICIAN" = "USER") {
  const authRepository: AuthRepository = {
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    createUser: vi.fn(),
    setUserRole: vi.fn(),
    findUserBySession: vi.fn(async (token) =>
      token === "valid" ? { id: userId, name: "User", username: "user", role } : null
    )
  };
  const ticketRepository: TicketRepository = {
    create: vi.fn(),
    listRecent: vi.fn(),
    findById: vi.fn().mockResolvedValue({ id: ticketId }),
    createReply: vi.fn(),
    listRecentReplies: vi.fn().mockResolvedValue([]),
    assignTechnician: vi.fn(),
    updateStatus: vi.fn(),
    listTicketVotes: vi.fn(),
    getTicketVote: vi.fn(async (_id: string, viewerId?: string) => ({
      ...vote,
      userVote: viewerId ? (1 as const) : null
    })),
    setReplyVote: vi.fn(),
    setTicketVote: vi.fn().mockResolvedValue({ type: "updated", vote })
  };
  const app = buildApp({ authRepository, ticketRepository, logger: false });
  apps.push(app);
  return { app, ticketRepository, authRepository };
}
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("ticket voting authorization", () => {
  it.each(["USER", "TECHNICIAN"] as const)(
    "allows %s to vote with the session identity",
    async (role) => {
      const { app, ticketRepository } = setup(role);
      const response = await app.inject({
        method: "PUT",
        url,
        cookies: { [sessionCookieName]: "valid" },
        payload: { value: 1 }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(vote);
      expect(ticketRepository.setTicketVote).toHaveBeenCalledWith(ticketId, userId, 1);
      expect(response.headers["cache-control"]).toBe("private, no-store");
    }
  );
  it.each([undefined, "expired", "revoked"])(
    "rejects missing or invalid session %s for every mutation",
    async (token) => {
      const { app, ticketRepository } = setup();
      for (const method of ["PUT", "DELETE"] as const) {
        const response = await app.inject({
          method,
          url,
          ...(token ? { cookies: { [sessionCookieName]: token } } : {}),
          ...(method === "PUT" ? { payload: { value: -1 } } : {})
        });
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ error: { code: "AUTHENTICATION_REQUIRED" } });
      }
      expect(ticketRepository.setTicketVote).not.toHaveBeenCalled();
    }
  );
  it("removes a vote for the session user", async () => {
    const { app, ticketRepository } = setup();
    const response = await app.inject({
      method: "DELETE",
      url,
      cookies: { [sessionCookieName]: "valid" }
    });
    expect(response.statusCode).toBe(200);
    expect(ticketRepository.setTicketVote).toHaveBeenCalledWith(ticketId, userId, null);
  });
  it.each([{ value: 0 }, { value: 2 }, { value: "1" }, {}, { value: 1, userId: "other" }])(
    "rejects invalid vote %j",
    async (payload) => {
      const { app, ticketRepository } = setup();
      const response = await app.inject({
        method: "PUT",
        url,
        cookies: { [sessionCookieName]: "valid" },
        payload
      });
      expect(response.statusCode).toBe(400);
      expect(ticketRepository.setTicketVote).not.toHaveBeenCalled();
    }
  );
  it("returns 404 for an absent ticket", async () => {
    const { app, ticketRepository } = setup();
    vi.mocked(ticketRepository.setTicketVote).mockResolvedValue({ type: "ticket-not-found" });
    const response = await app.inject({
      method: "PUT",
      url,
      cookies: { [sessionCookieName]: "valid" },
      payload: { value: 1 }
    });
    expect(response.statusCode).toBe(404);
  });
  it("does not expose database errors", async () => {
    const { app, ticketRepository } = setup();
    vi.mocked(ticketRepository.setTicketVote).mockRejectedValue(
      new Error("private database details")
    );
    const response = await app.inject({
      method: "PUT",
      url,
      cookies: { [sessionCookieName]: "valid" },
      payload: { value: 1 }
    });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("private database details");
  });
  it.each([undefined, "valid"])(
    "returns public totals and only the session viewer selection (%s)",
    async (token) => {
      const { app, ticketRepository } = setup();
      const response = await app.inject({
        method: "GET",
        url,
        ...(token ? { cookies: { [sessionCookieName]: token } } : {})
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ...vote, userVote: token ? 1 : null });
      expect(ticketRepository.getTicketVote).toHaveBeenCalledWith(
        ticketId,
        token ? userId : undefined
      );
      expect(response.headers["cache-control"]).toBe("private, no-store");
    }
  );
  it("returns 404 when reading an absent ticket", async () => {
    const { app, ticketRepository } = setup();
    vi.mocked(ticketRepository.getTicketVote).mockResolvedValue(null);
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(404);
  });
  it.each(["GET", "PUT", "DELETE"] as const)(
    "rejects malformed IDs for %s without querying",
    async (method) => {
      const { app, ticketRepository } = setup();
      const response = await app.inject({
        method,
        url: "/api/tickets/not-a-uuid/vote",
        cookies: { [sessionCookieName]: "valid" },
        ...(method === "PUT" ? { payload: { value: 1 } } : {})
      });
      expect(response.statusCode).toBe(400);
      expect(ticketRepository.getTicketVote).not.toHaveBeenCalled();
      expect(ticketRepository.setTicketVote).not.toHaveBeenCalled();
    }
  );
  it.each([undefined, "valid"])(
    "batches ticket-list votes for the session viewer (%s)",
    async (token) => {
      const { app, ticketRepository } = setup();
      vi.mocked(ticketRepository.listRecent).mockResolvedValue([
        {
          id: ticketId,
          title: "Test",
          description: "Test",
          setup: "Test",
          additionalInformation: null,
          assignedTechnicianId: null,
          createdByName: null,
          status: "OPEN",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
      const listTicketVotes = vi
        .fn()
        .mockResolvedValue([{ ticketId, ...vote, userVote: token ? 1 : null }]);
      Object.assign(ticketRepository, { listTicketVotes });
      const response = await app.inject({
        method: "GET",
        url: "/api/tickets",
        ...(token ? { cookies: { [sessionCookieName]: token } } : {})
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().tickets[0].votes).toEqual({ ...vote, userVote: token ? 1 : null });
      expect(listTicketVotes).toHaveBeenCalledWith([ticketId], token ? userId : undefined);
      expect(ticketRepository.getTicketVote).not.toHaveBeenCalled();
      expect(response.headers["cache-control"]).toBe("private, no-store");
    }
  );
});
