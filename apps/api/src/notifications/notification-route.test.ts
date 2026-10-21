import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import type { AuthenticatedUser } from "../auth/auth-contract.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import type { TicketRepository } from "../tickets/ticket-repository.js";
import type { NotificationRecord, NotificationRepository } from "./notification-repository.js";

const user: AuthenticatedUser = {
  id: "bb97588e-0e8b-49e1-980b-4b9207121898",
  name: "Uma User",
  username: "uma",
  role: "USER"
};

const authRepository: AuthRepository = {
  createSession: vi.fn(),
  findUserBySession: async (token) => (token === "user-session" ? user : null),
  deleteSession: vi.fn(),
  createUser: vi.fn(),
  setUserRole: vi.fn()
};

const ticketRepository: TicketRepository = {
  create: vi.fn(),
  listRecent: vi.fn(),
  findById: vi.fn(),
  createReply: vi.fn(),
  listRecentReplies: vi.fn(),
  assignTechnician: vi.fn(),
  updateStatus: vi.fn()
};

const storedNotification: NotificationRecord = {
  id: "5d4c1f0e-6f0a-4a57-9d0b-3a0b6a1f2c11",
  ticketId: "cc04d84c-9aee-4d35-8af3-999d861aaed6",
  ticketTitle: "Printer offline",
  previousStatus: "UNDER_REVIEW",
  newStatus: "IN_PROGRESS",
  createdAt: new Date("2026-10-19T18:00:00.000Z"),
  readAt: null
};

describe("notification routes", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function buildNotificationApp() {
    const notificationRepository = {
      listRecent: vi
        .fn<NotificationRepository["listRecent"]>()
        .mockResolvedValue({ notifications: [storedNotification], unreadCount: 3 }),
      markAllRead: vi.fn<NotificationRepository["markAllRead"]>().mockResolvedValue()
    };
    const app = buildApp({
      authRepository,
      ticketRepository,
      notificationRepository,
      logger: false
    });
    apps.push(app);
    return { app, notificationRepository };
  }

  it.each([
    ["GET", "/api/notifications"],
    ["POST", "/api/notifications/read"]
  ] as const)("%s %s requires a valid session", async (method, url) => {
    const { app, notificationRepository } = buildNotificationApp();

    const response = await app.inject({
      method,
      url,
      headers: { cookie: "betterticket_session=expired" }
    });

    expect(response.statusCode).toBe(401);
    expect(notificationRepository.listRecent).not.toHaveBeenCalled();
    expect(notificationRepository.markAllRead).not.toHaveBeenCalled();
  });

  it("lists only the session user's recent notifications", async () => {
    const { app, notificationRepository } = buildNotificationApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { cookie: "betterticket_session=user-session" }
    });

    expect(response.statusCode).toBe(200);
    expect(notificationRepository.listRecent).toHaveBeenCalledWith(user.id, 20);
    expect(response.json()).toEqual({
      notifications: [
        {
          ...storedNotification,
          createdAt: "2026-10-19T18:00:00.000Z",
          readAt: null
        }
      ],
      unreadCount: 3
    });
  });

  it("marks only the session user's notifications as read", async () => {
    const { app, notificationRepository } = buildNotificationApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/notifications/read",
      headers: { cookie: "betterticket_session=user-session" }
    });

    expect(response.statusCode).toBe(204);
    expect(notificationRepository.markAllRead).toHaveBeenCalledWith(user.id);
  });
});
