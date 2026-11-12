import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import type { NotificationRepository } from "../notifications/notification-repository.js";
import type { SettingsRepository } from "../settings/settings-repository.js";
import type {
  AttachmentRecord,
  NewAttachmentRecord,
  TicketCreator,
  TicketRecord,
  TicketRepository
} from "../tickets/ticket-repository.js";
import type { AttachmentStorage } from "./attachment-storage.js";

const ticketId = "cc04d84c-9aee-4d35-8af3-999d861aaed6";
const attachmentId = "18b3475e-d17a-4bb0-8c7b-f287a4d79130";
const user = {
  id: "bb97588e-0e8b-49e1-980b-4b9207121898",
  name: "Uma User",
  username: "uma",
  role: "USER" as const
};

class FakeTicketRepository implements TicketRepository {
  createdAttachments: NewAttachmentRecord[] = [];
  failCreate = false;
  storedTicket: TicketRecord | null = null;
  storedAttachments: AttachmentRecord[] = [];

  async create(
    input: Parameters<TicketRepository["create"]>[0],
    creator: TicketCreator | null = null,
    attachments: NewAttachmentRecord[] = []
  ): Promise<TicketRecord> {
    if (this.failCreate) {
      throw new Error("database unavailable");
    }
    this.createdAttachments = attachments;
    this.storedTicket = {
      id: ticketId,
      ...input,
      additionalInformation: input.additionalInformation ?? null,
      status: "OPEN",
      replyStatus: "OPEN",
      priority: input.priority ?? "MEDIUM",
      visibility: input.visibility ?? "PUBLIC",
      creatorUserId: creator?.id ?? null,
      assignedTechnicianId: null,
      createdByName: creator?.name ?? null,
      createdAt: new Date("2026-11-11T18:00:00.000Z"),
      updatedAt: new Date("2026-11-11T18:00:00.000Z")
    };
    this.storedAttachments = attachments.map((attachment) => ({
      ...attachment,
      ticketId,
      createdAt: new Date("2026-11-11T18:00:00.000Z")
    }));
    return this.storedTicket;
  }

  async findById(id: string) {
    return id === ticketId ? this.storedTicket : null;
  }

  async listAttachments(id: string) {
    return id === ticketId ? this.storedAttachments : [];
  }

  async findAttachment(id: string, idOfAttachment: string) {
    return (
      this.storedAttachments.find(
        (attachment) => attachment.ticketId === id && attachment.id === idOfAttachment
      ) ?? null
    );
  }

  async listRecent() {
    return [];
  }
  async createReply() {
    return { type: "ticket-not-found" as const };
  }
  async listRecentReplies() {
    return [];
  }
  async assignTechnician() {
    return { type: "ticket-not-found" as const };
  }
  async updateStatus() {
    return { type: "ticket-not-found" as const };
  }
  async endorseReply() {
    return { type: "reply-not-found" as const };
  }
  async withdrawEndorsement() {
    return { type: "endorsement-not-found" as const };
  }
}

class FakeAttachmentStorage implements AttachmentStorage {
  readonly stored = new Map<string, { body: Buffer; contentType: string }>();
  deleted: string[] = [];

  async put(objectKey: string, body: Buffer, contentType: string) {
    this.stored.set(objectKey, { body, contentType });
  }

  async get(objectKey: string) {
    const stored = this.stored.get(objectKey);
    return stored
      ? {
          body: Readable.from(stored.body),
          contentLength: stored.body.length,
          contentType: stored.contentType
        }
      : null;
  }

  async delete(objectKey: string) {
    this.deleted.push(objectKey);
    this.stored.delete(objectKey);
  }
}

const authRepository: AuthRepository = {
  createSession: vi.fn(),
  findUserBySession: async (token) => (token === "user-session" ? user : null),
  deleteSession: vi.fn(),
  createUser: vi.fn(),
  setUserRole: vi.fn()
};
const notificationRepository: NotificationRepository = {
  listRecent: vi.fn(),
  markAllRead: vi.fn()
};
const settingsRepository: SettingsRepository = {
  findNotificationSettings: vi.fn(),
  saveNotificationSettings: vi.fn()
};

async function multipartPayload(fileName = "screenshot.png", fileBody?: Uint8Array) {
  const form = new FormData();
  form.append("title", "Screenshot attached");
  form.append("description", "The screen is blank");
  form.append("setup", "Firefox on Fedora");
  form.append("priority", "MEDIUM");
  form.append("visibility", "PUBLIC");
  form.append(
    "attachments",
    new Blob(
      [
        (
          fileBody ??
          new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52
          ])
        ).buffer as ArrayBuffer
      ],
      { type: "image/png" }
    ),
    fileName
  );
  const request = new Request("http://localhost/api/tickets", { method: "POST", body: form });
  return {
    payload: Buffer.from(await request.arrayBuffer()),
    headers: { "content-type": request.headers.get("content-type") ?? "" }
  };
}

describe("ticket attachments", () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function setup() {
    const ticketRepository = new FakeTicketRepository();
    const attachmentStorage = new FakeAttachmentStorage();
    const app = buildApp({
      authRepository,
      ticketRepository,
      attachmentStorage,
      notificationRepository,
      settingsRepository,
      logger: false
    });
    apps.push(app);
    return { app, ticketRepository, attachmentStorage };
  }

  it("creates an authenticated multipart ticket and stores detected attachment metadata", async () => {
    const { app, ticketRepository, attachmentStorage } = setup();
    const request = await multipartPayload();

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { ...request.headers, cookie: "betterticket_session=user-session" },
      payload: request.payload
    });

    expect(response.statusCode).toBe(201);
    expect(ticketRepository.createdAttachments).toMatchObject([
      { fileName: "screenshot.png", contentType: "image/png", sizeBytes: 16 }
    ]);
    expect(attachmentStorage.stored.size).toBe(1);
  });

  it("rejects an anonymous multipart ticket before storing a file", async () => {
    const { app, attachmentStorage } = setup();
    const request = await multipartPayload();

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: request.headers,
      payload: request.payload
    });

    expect(response.statusCode).toBe(401);
    expect(attachmentStorage.stored.size).toBe(0);
  });

  it("rejects unsupported content without storing a file", async () => {
    const { app, attachmentStorage } = setup();
    const request = await multipartPayload("script.svg", new TextEncoder().encode("<svg />"));

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { ...request.headers, cookie: "betterticket_session=user-session" },
      payload: request.payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "ATTACHMENT_INVALID" } });
    expect(attachmentStorage.stored.size).toBe(0);
  });

  it("deletes uploaded objects when ticket persistence fails", async () => {
    const { app, ticketRepository, attachmentStorage } = setup();
    ticketRepository.failCreate = true;
    const request = await multipartPayload();

    const response = await app.inject({
      method: "POST",
      url: "/api/tickets",
      headers: { ...request.headers, cookie: "betterticket_session=user-session" },
      payload: request.payload
    });

    expect(response.statusCode).toBe(500);
    expect(attachmentStorage.stored.size).toBe(0);
    expect(attachmentStorage.deleted).toHaveLength(1);
  });

  it("lists metadata and streams an image preview through ticket visibility", async () => {
    const { app, ticketRepository, attachmentStorage } = setup();
    ticketRepository.storedTicket = await ticketRepository.create(
      { title: "Public", description: "Description", setup: "Setup" },
      user,
      [
        {
          id: attachmentId,
          objectKey: "attachments/test-object",
          fileName: "screenshot.png",
          contentType: "image/png",
          sizeBytes: 3
        }
      ]
    );
    attachmentStorage.stored.set("attachments/test-object", {
      body: Buffer.from([1, 2, 3]),
      contentType: "image/png"
    });

    const list = await app.inject({ method: "GET", url: `/api/tickets/${ticketId}/attachments` });
    const preview = await app.inject({
      method: "GET",
      url: `/api/tickets/${ticketId}/attachments/${attachmentId}?preview=true`
    });

    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      attachments: [{ id: attachmentId, fileName: "screenshot.png", sizeBytes: 3 }]
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["content-type"]).toContain("image/png");
    expect(preview.headers["content-disposition"]).toContain("inline");
    expect(preview.rawPayload).toEqual(Buffer.from([1, 2, 3]));
  });

  it("does not reveal attachments from a private ticket to another viewer", async () => {
    const { app, ticketRepository } = setup();
    ticketRepository.storedTicket = await ticketRepository.create(
      {
        title: "Private",
        description: "Description",
        setup: "Setup",
        visibility: "PRIVATE"
      },
      user,
      [
        {
          id: attachmentId,
          objectKey: "attachments/private-object",
          fileName: "private.pdf",
          contentType: "application/pdf",
          sizeBytes: 3
        }
      ]
    );

    const response = await app.inject({
      method: "GET",
      url: `/api/tickets/${ticketId}/attachments`
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "The attachment was not found" }
    });
  });
});
