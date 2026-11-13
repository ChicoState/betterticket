import { randomUUID } from "node:crypto";

import type { FastifyRequest } from "fastify";

import type { NewAttachmentRecord } from "../tickets/ticket-repository.js";
import type { AttachmentStorage } from "./attachment-storage.js";
import {
  AttachmentValidationError,
  attachmentLimits,
  validateAttachment,
  type ValidatedAttachment
} from "./attachment-validation.js";

export class AttachmentLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentLimitError";
  }
}

export interface ParsedTicketMultipart {
  input: unknown;
  attachments: ValidatedAttachment[];
}

function ticketInputFromFields(fields: Record<string, unknown>): unknown {
  const input = { ...fields };
  if (typeof input.additionalInformation === "string" && input.additionalInformation.length === 0) {
    delete input.additionalInformation;
  }
  if (input.postAnonymously === "true" || input.postAnonymously === "on") {
    input.postAnonymously = true;
  } else if (input.postAnonymously === undefined) {
    // Keep the optional field absent.
  } else {
    input.postAnonymously = false;
  }
  return input;
}

export async function parseTicketMultipart(
  request: FastifyRequest
): Promise<ParsedTicketMultipart> {
  const fields: Record<string, unknown> = {};
  const attachments: ValidatedAttachment[] = [];
  let totalBytes = 0;

  const parts = request.parts({
    limits: {
      fieldNameSize: 100,
      fieldSize: 20_000,
      fields: 7,
      files: attachmentLimits.maxFiles,
      fileSize: attachmentLimits.maxFileBytes,
      parts: 12
    }
  });

  for await (const part of parts) {
    if (part.type === "field") {
      if (part.fieldname in fields) {
        throw new AttachmentValidationError(`The ${part.fieldname} field was submitted twice`);
      }
      fields[part.fieldname] = part.value;
      continue;
    }

    if (part.fieldname !== "attachments") {
      await part.toBuffer();
      throw new AttachmentValidationError("Unknown file field");
    }

    const buffer = await part.toBuffer();
    totalBytes += buffer.length;
    if (totalBytes > attachmentLimits.maxTotalBytes) {
      throw new AttachmentLimitError("Attachments exceed the 25 MiB combined limit");
    }
    attachments.push(
      await validateAttachment({
        fileName: part.filename,
        claimedContentType: part.mimetype,
        buffer
      })
    );
  }

  if (attachments.length === 0) {
    throw new AttachmentValidationError(
      "At least one attachment is required for multipart creation"
    );
  }

  return { input: ticketInputFromFields(fields), attachments };
}

export async function storeAttachments(
  storage: AttachmentStorage,
  attachments: ValidatedAttachment[]
): Promise<NewAttachmentRecord[]> {
  const stored: NewAttachmentRecord[] = [];

  try {
    for (const attachment of attachments) {
      const id = randomUUID();
      const objectKey = `attachments/${randomUUID()}`;
      await storage.put(objectKey, attachment.buffer, attachment.contentType);
      stored.push({
        id,
        objectKey,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes
      });
    }
  } catch (error) {
    await cleanupAttachments(storage, stored);
    throw error;
  }

  return stored;
}

export async function cleanupAttachments(
  storage: AttachmentStorage,
  attachments: NewAttachmentRecord[]
): Promise<void> {
  await Promise.allSettled(attachments.map((attachment) => storage.delete(attachment.objectKey)));
}
