import { Readable } from "node:stream";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

import type { AttachmentStorage, StoredAttachmentContent } from "./attachment-storage.js";

interface S3CommandClient {
  send(command: object): Promise<unknown>;
  destroy?(): void;
}

function isMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const metadata = "$metadata" in error ? error.$metadata : undefined;
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 404
  );
}

export class S3AttachmentStorage implements AttachmentStorage {
  constructor(
    private readonly client: S3CommandClient,
    private readonly bucket: string,
    private readonly createBucketIfMissing: boolean
  ) {}

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if (!this.createBucketIfMissing || !isMissing(error)) {
        throw error;
      }
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async put(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentLength: body.length,
        ContentType: contentType
      })
    );
  }

  async get(objectKey: string): Promise<StoredAttachmentContent | null> {
    try {
      const response = (await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey })
      )) as {
        Body?: unknown;
        ContentLength?: number;
        ContentType?: string;
      };
      if (!(response.Body instanceof Readable) || response.ContentLength === undefined) {
        throw new Error("Object storage returned an invalid attachment body");
      }
      return {
        body: response.Body,
        contentLength: response.ContentLength,
        contentType: response.ContentType ?? "application/octet-stream"
      };
    } catch (error) {
      if (isMissing(error)) {
        return null;
      }
      throw error;
    }
  }

  async delete(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }

  close(): void {
    this.client.destroy?.();
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to start the API`);
  }
  return value;
}

export function createS3AttachmentStorageFromEnvironment(): S3AttachmentStorage {
  const storage = new S3AttachmentStorage(
    new S3Client({
      endpoint: requiredEnvironment("OBJECT_STORAGE_ENDPOINT"),
      region: process.env.OBJECT_STORAGE_REGION ?? "us-east-1",
      forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== "false",
      credentials: {
        accessKeyId: requiredEnvironment("OBJECT_STORAGE_ACCESS_KEY"),
        secretAccessKey: requiredEnvironment("OBJECT_STORAGE_SECRET_KEY")
      }
    }),
    requiredEnvironment("OBJECT_STORAGE_BUCKET"),
    process.env.OBJECT_STORAGE_AUTO_CREATE_BUCKET === "true"
  );
  return storage;
}
