import path from "node:path";

import { fileTypeFromBuffer, type FileTypeResult } from "file-type";

export const attachmentLimits = {
  maxFiles: 5,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
  maxFileNameCharacters: 255
} as const;

const allowedBinaryTypes = new Map<string, string>([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
  ["pdf", "application/pdf"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
]);

const officeExtensions = new Set(["docx", "xlsx", "pptx"]);

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

export interface UnvalidatedAttachment {
  fileName: string;
  claimedContentType: string;
  buffer: Buffer;
}

export interface ValidatedAttachment {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  buffer: Buffer;
}

function normalizeFileName(rawFileName: string): string {
  const withoutControls = Array.from(rawFileName.normalize("NFC"))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127;
    })
    .join("");
  const fileName = path.posix.basename(withoutControls.replaceAll("\\", "/")).trim();

  if (
    fileName.length === 0 ||
    fileName === "." ||
    fileName === ".." ||
    fileName.length > attachmentLimits.maxFileNameCharacters
  ) {
    throw new AttachmentValidationError("The attachment filename is invalid");
  }

  return fileName;
}

function extensionOf(fileName: string): string {
  return path.extname(fileName).slice(1).toLowerCase();
}

function validateUtf8Text(buffer: Buffer): void {
  if (buffer.includes(0)) {
    throw new AttachmentValidationError("Text attachments cannot contain binary data");
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new AttachmentValidationError("Text attachments must use UTF-8 encoding");
  }
}

export function containsOfficeMacros(buffer: Buffer): boolean {
  return buffer.toString("latin1").toLowerCase().includes("vbaproject.bin");
}

function validateDetectedType(extension: string, detected: FileTypeResult | undefined): string {
  const expectedContentType = allowedBinaryTypes.get(extension);
  if (!expectedContentType || !detected) {
    throw new AttachmentValidationError("The attachment type is not allowed");
  }

  const detectedExtension = detected.ext === "jpg" ? "jpeg" : detected.ext;
  const requestedExtension = extension === "jpg" ? "jpeg" : extension;
  if (detectedExtension !== requestedExtension || detected.mime !== expectedContentType) {
    throw new AttachmentValidationError("The attachment content does not match its filename");
  }

  return expectedContentType;
}

export async function validateAttachment(
  attachment: UnvalidatedAttachment
): Promise<ValidatedAttachment> {
  const fileName = normalizeFileName(attachment.fileName);
  const extension = extensionOf(fileName);

  if (attachment.buffer.length === 0 || attachment.buffer.length > attachmentLimits.maxFileBytes) {
    throw new AttachmentValidationError("The attachment size is invalid");
  }

  let contentType: string;
  if (extension === "txt" || extension === "log") {
    validateUtf8Text(attachment.buffer);
    contentType = "text/plain";
  } else {
    contentType = validateDetectedType(extension, await fileTypeFromBuffer(attachment.buffer));
  }

  if (officeExtensions.has(extension) && containsOfficeMacros(attachment.buffer)) {
    throw new AttachmentValidationError("Macro-enabled Office attachments are not allowed");
  }

  return {
    fileName,
    contentType,
    sizeBytes: attachment.buffer.length,
    buffer: attachment.buffer
  };
}
