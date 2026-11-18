import { describe, expect, it } from "vitest";

import {
  AttachmentValidationError,
  attachmentLimits,
  containsOfficeMacros,
  validateAttachment
} from "./attachment-validation.js";

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
]);

describe("validateAttachment", () => {
  it("accepts a detected image and normalizes its display filename", async () => {
    const attachment = await validateAttachment({
      fileName: "folder\\screen\u0000shot.png",
      claimedContentType: "application/octet-stream",
      buffer: png
    });

    expect(attachment).toEqual({
      fileName: "screenshot.png",
      contentType: "image/png",
      sizeBytes: png.length,
      buffer: png
    });
  });

  it("accepts UTF-8 text and log files", async () => {
    const buffer = Buffer.from("Connection timed out\n");

    await expect(
      validateAttachment({ fileName: "network.log", claimedContentType: "text/plain", buffer })
    ).resolves.toMatchObject({ contentType: "text/plain", sizeBytes: buffer.length });
  });

  it.each([
    ["script.svg", Buffer.from("<svg></svg>")],
    ["report.exe", Buffer.from("MZ")],
    ["photo.jpg", png],
    ["notes.txt", Buffer.from([0x61, 0x00, 0x62])]
  ])("rejects unsafe or mismatched file %s", async (fileName, buffer) => {
    await expect(
      validateAttachment({ fileName, claimedContentType: "application/octet-stream", buffer })
    ).rejects.toBeInstanceOf(AttachmentValidationError);
  });

  it("rejects empty and oversized files", async () => {
    await expect(
      validateAttachment({
        fileName: "empty.txt",
        claimedContentType: "text/plain",
        buffer: Buffer.alloc(0)
      })
    ).rejects.toBeInstanceOf(AttachmentValidationError);

    await expect(
      validateAttachment({
        fileName: "large.txt",
        claimedContentType: "text/plain",
        buffer: Buffer.alloc(attachmentLimits.maxFileBytes + 1, 0x61)
      })
    ).rejects.toBeInstanceOf(AttachmentValidationError);
  });

  it("detects the macro payload entry used by macro-enabled OOXML files", () => {
    expect(containsOfficeMacros(Buffer.from("word/document.xml\u0000word/vbaProject.bin"))).toBe(
      true
    );
    expect(containsOfficeMacros(Buffer.from("word/document.xml\u0000word/styles.xml"))).toBe(false);
  });
});
