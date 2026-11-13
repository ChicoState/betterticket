export interface AttachmentMetadata {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AttachmentList {
  attachments: AttachmentMetadata[];
}

export const attachmentListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["attachments"],
  properties: {
    attachments: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "fileName", "contentType", "sizeBytes", "createdAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          fileName: { type: "string", minLength: 1, maxLength: 255 },
          contentType: { type: "string", minLength: 1, maxLength: 127 },
          sizeBytes: { type: "integer", minimum: 1 },
          createdAt: { type: "string", format: "date-time" }
        }
      }
    }
  }
} as const;

export interface AttachmentListParams {
  ticketId: string;
}

export interface AttachmentContentParams extends AttachmentListParams {
  attachmentId: string;
}

export const attachmentListParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId"],
  properties: { ticketId: { type: "string", format: "uuid" } }
} as const;

export const attachmentContentParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId", "attachmentId"],
  properties: {
    ticketId: { type: "string", format: "uuid" },
    attachmentId: { type: "string", format: "uuid" }
  }
} as const;

export const attachmentContentQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: { preview: { type: "string", enum: ["true"] } }
} as const;
