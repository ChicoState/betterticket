import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import type { AuthenticatedUser } from "../auth/auth-contract.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import type { NotificationRepository } from "../notifications/notification-repository.js";
import type { TicketRepository } from "../tickets/ticket-repository.js";
import type { NotificationSettings } from "./settings-contract.js";
import type { SettingsRepository } from "./settings-repository.js";

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

const notificationRepository: NotificationRepository = {
  listRecent: vi.fn(),
  markAllRead: vi.fn()
};

const sessionCookie = { cookie: "betterticket_session=user-session" };

const enabledSettings: NotificationSettings = {
  email: "uma@example.com",
  emailEnabled: true,
  emailStatuses: ["IN_PROGRESS", "RESOLVED"]
};

describe("notification settings routes", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function buildSettingsApp(stored: NotificationSettings | null = null) {
    const settingsRepository = {
      findNotificationSettings: vi
        .fn<SettingsRepository["findNotificationSettings"]>()
        .mockResolvedValue(stored),
      saveNotificationSettings: vi
        .fn<SettingsRepository["saveNotificationSettings"]>()
        .mockImplementation(async (_userId, settings) => settings)
    };
    const app = buildApp({
      authRepository,
      ticketRepository,
      notificationRepository,
      settingsRepository,
      logger: false
    });
    apps.push(app);
    return { app, settingsRepository };
  }

  it.each(["GET", "PUT"] as const)("%s requires a valid session", async (method) => {
    const { app, settingsRepository } = buildSettingsApp();

    const response = await app.inject({
      method,
      url: "/api/settings/notifications",
      headers: { cookie: "betterticket_session=expired" },
      ...(method === "PUT" ? { payload: enabledSettings } : {})
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "AUTHENTICATION_REQUIRED" } });
    expect(settingsRepository.findNotificationSettings).not.toHaveBeenCalled();
    expect(settingsRepository.saveNotificationSettings).not.toHaveBeenCalled();
  });

  it("returns defaults when the user has not saved settings", async () => {
    const { app, settingsRepository } = buildSettingsApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/settings/notifications",
      headers: sessionCookie
    });

    expect(response.statusCode).toBe(200);
    expect(settingsRepository.findNotificationSettings).toHaveBeenCalledWith(user.id);
    expect(response.json()).toEqual({
      email: null,
      emailEnabled: false,
      emailStatuses: ["RESOLVED"]
    });
  });

  it("returns the session user's saved settings", async () => {
    const { app } = buildSettingsApp(enabledSettings);

    const response = await app.inject({
      method: "GET",
      url: "/api/settings/notifications",
      headers: sessionCookie
    });

    expect(response.json()).toEqual(enabledSettings);
  });

  it("saves normalized settings for the session user", async () => {
    const { app, settingsRepository } = buildSettingsApp();

    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/notifications",
      headers: sessionCookie,
      payload: {
        email: "  Uma@Example.COM ",
        emailEnabled: true,
        emailStatuses: ["RESOLVED", "UNDER_REVIEW"]
      }
    });

    const expected = {
      email: "uma@example.com",
      emailEnabled: true,
      emailStatuses: ["UNDER_REVIEW", "RESOLVED"]
    };
    expect(response.statusCode).toBe(200);
    expect(settingsRepository.saveNotificationSettings).toHaveBeenCalledWith(user.id, expected);
    expect(response.json()).toEqual(expected);
  });

  it("saves a disabled preference without an email address", async () => {
    const { app } = buildSettingsApp();

    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/notifications",
      headers: sessionCookie,
      payload: { email: null, emailEnabled: false, emailStatuses: [] }
    });

    expect(response.statusCode).toBe(200);
  });

  it.each([
    ["an unknown field", { ...enabledSettings, digest: "daily" }],
    ["a client-supplied user id", { ...enabledSettings, userId: user.id }],
    ["an invalid email", { ...enabledSettings, email: "not-an-email" }],
    ["an overlong email", { ...enabledSettings, email: `${"a".repeat(250)}@example.com` }],
    ["a duplicate status", { ...enabledSettings, emailStatuses: ["RESOLVED", "RESOLVED"] }],
    ["a status that cannot be emailed", { ...enabledSettings, emailStatuses: ["OPEN"] }],
    ["a missing field", { email: "uma@example.com", emailEnabled: true }]
  ])("rejects %s", async (_case, payload) => {
    const { app, settingsRepository } = buildSettingsApp();

    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/notifications",
      headers: sessionCookie,
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(settingsRepository.saveNotificationSettings).not.toHaveBeenCalled();
  });

  it.each([
    ["no email address", { ...enabledSettings, email: null }],
    ["a blank email address", { ...enabledSettings, email: "   " }],
    ["no statuses", { ...enabledSettings, emailStatuses: [] }]
  ])("rejects enabling email updates with %s", async (_case, payload) => {
    const { app, settingsRepository } = buildSettingsApp();

    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/notifications",
      headers: sessionCookie,
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "EMAIL_SETTINGS_INCOMPLETE" } });
    expect(settingsRepository.saveNotificationSettings).not.toHaveBeenCalled();
  });

  it("limits settings updates per session", async () => {
    const { app } = buildSettingsApp();
    const update = () =>
      app.inject({
        method: "PUT",
        url: "/api/settings/notifications",
        headers: sessionCookie,
        payload: enabledSettings
      });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await update()).statusCode).toBe(200);
    }
    const limited = await update();

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "Too many settings updates" }
    });
  });
});
