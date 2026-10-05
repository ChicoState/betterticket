export const ticketStatuses = ["OPEN", "RESOLVED"] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export interface CreateTicketInput {
  title: string;
  description: string;
  setup: string;
  additionalInformation?: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  setup: string;
  additionalInformation: string | null;
  ownerId: string | null;
  solutionCommentId: string | null;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

const requiredText = (maxLength: number) => ({
  type: "string",
  minLength: 1,
  maxLength,
  pattern: "\\S"
});

export const createTicketBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "setup"],
  properties: {
    title: requiredText(160),
    description: requiredText(5_000),
    setup: requiredText(3_000),
    additionalInformation: requiredText(3_000)
  }
} as const;

export const ticketResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "title",
    "description",
    "setup",
    "additionalInformation",
    "ownerId",
    "solutionCommentId",
    "status",
    "createdAt",
    "updatedAt"
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    description: { type: "string" },
    setup: { type: "string" },
    additionalInformation: { type: ["string", "null"] },
    ownerId: { type: ["string", "null"], format: "uuid" },
    solutionCommentId: { type: ["string", "null"], format: "uuid" },
    status: { type: "string", enum: ticketStatuses },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" }
  }
} as const;

export const apiErrorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" }
      }
    }
  }
} as const;

export function normalizeCreateTicketInput(input: CreateTicketInput): CreateTicketInput {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    setup: input.setup.trim(),
    ...(input.additionalInformation === undefined
      ? {}
      : { additionalInformation: input.additionalInformation.trim() })
  };
}
