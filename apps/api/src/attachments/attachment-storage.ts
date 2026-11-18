import type { Readable } from "node:stream";

export interface StoredAttachmentContent {
  body: Readable;
  contentLength: number;
  contentType: string;
}

export interface AttachmentStorage {
  put(objectKey: string, body: Buffer, contentType: string): Promise<void>;
  get(objectKey: string): Promise<StoredAttachmentContent | null>;
  delete(objectKey: string): Promise<void>;
  close?(): void;
}

export const unavailableAttachmentStorage: AttachmentStorage = {
  async put() {
    throw new Error("Attachment storage is unavailable");
  },
  async get() {
    throw new Error("Attachment storage is unavailable");
  },
  async delete() {
    throw new Error("Attachment storage is unavailable");
  }
};
