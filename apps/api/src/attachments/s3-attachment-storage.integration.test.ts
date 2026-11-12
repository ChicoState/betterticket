import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createS3AttachmentStorageFromEnvironment } from "./s3-attachment-storage.js";

const storage = createS3AttachmentStorageFromEnvironment();
const objectKeys: string[] = [];

describe("S3AttachmentStorage integration", () => {
  beforeAll(() => storage.ensureBucket());

  afterAll(async () => {
    await Promise.allSettled(objectKeys.map((objectKey) => storage.delete(objectKey)));
    storage.close();
  });

  it("round-trips and deletes an attachment through S3-compatible storage", async () => {
    const objectKey = `integration-tests/${randomUUID()}`;
    objectKeys.push(objectKey);
    const expected = Buffer.from("attachment integration test");

    await storage.put(objectKey, expected, "text/plain");
    const stored = await storage.get(objectKey);
    if (!stored) {
      throw new Error("Stored integration attachment was not found");
    }
    const chunks: Buffer[] = [];
    for await (const chunk of stored.body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    expect(Buffer.concat(chunks)).toEqual(expected);
    expect(stored.contentLength).toBe(expected.length);
    expect(stored.contentType).toBe("text/plain");

    await storage.delete(objectKey);
    objectKeys.splice(objectKeys.indexOf(objectKey), 1);
    await expect(storage.get(objectKey)).resolves.toBeNull();
  });
});
