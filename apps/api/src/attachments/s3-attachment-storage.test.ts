import { Readable } from "node:stream";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { S3AttachmentStorage } from "./s3-attachment-storage.js";

describe("S3AttachmentStorage", () => {
  it("creates a missing local bucket only when configured to do so", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
      .mockResolvedValueOnce({});
    const storage = new S3AttachmentStorage({ send }, "attachments", true);

    await storage.ensureBucket();

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(CreateBucketCommand);
  });

  it("puts, gets, and deletes private objects", async () => {
    const body = Readable.from(Buffer.from("image"));
    const send = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Body: body,
        ContentLength: 5,
        ContentType: "image/png"
      })
      .mockResolvedValueOnce({});
    const storage = new S3AttachmentStorage({ send }, "attachments", false);

    await storage.put("attachments/key", Buffer.from("image"), "image/png");
    await expect(storage.get("attachments/key")).resolves.toEqual({
      body,
      contentLength: 5,
      contentType: "image/png"
    });
    await storage.delete("attachments/key");

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[2]?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it("returns null when an object is missing", async () => {
    const send = vi.fn().mockRejectedValue({ $metadata: { httpStatusCode: 404 } });
    const storage = new S3AttachmentStorage({ send }, "attachments", false);

    await expect(storage.get("attachments/missing")).resolves.toBeNull();
  });
});
