export const ticketStatuses = ["OPEN"] as const;

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
  status: TicketStatus;
  assignedTechnicianId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketAssignmentParams {
  ticketId: string;
}

export interface AssignTechnicianInput {
  assignedTechnicianId: string | null;
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
    "status",
    "assignedTechnicianId",
    "createdAt",
    "updatedAt"
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    description: { type: "string" },
    setup: { type: "string" },
    additionalInformation: { type: ["string", "null"] },
    status: { type: "string", enum: ticketStatuses },
    assignedTechnicianId: { type: ["string", "null"], format: "uuid" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" }
  }
} as const;

export const ticketListLimit = 100;

export interface TicketList {
  tickets: Ticket[];
}

export const ticketListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tickets"],
  properties: {
    tickets: {
      type: "array",
      maxItems: ticketListLimit,
      items: ticketResponseSchema
    }
  }
} as const;

export interface TicketParams {
  id: string;
}

export const ticketParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: { type: "string", format: "uuid" }
  }
} as const;

export interface CreateReplyInput {
  body: string;
}

export interface Reply {
  id: string;
  ticketId: string;
  body: string;
  createdAt: string;
}

export const createReplyBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["body"],
  properties: {
    body: requiredText(5_000)
  }
} as const;

export const replyResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "ticketId", "body", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    ticketId: { type: "string", format: "uuid" },
    body: { type: "string" },
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

export const replyListLimit = 200;

export interface ReplyList {
  replies: Reply[];
}

export const replyListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["replies"],
  properties: {
    replies: {
      type: "array",
      maxItems: replyListLimit,
      items: replyResponseSchema
    }
  }
} as const;

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export const ticketAssignmentParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId"],
  properties: {
    ticketId: { type: "string", format: "uuid" }
  }
} as const;

export const assignTechnicianBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["assignedTechnicianId"],
  properties: {
    assignedTechnicianId: { type: ["string", "null"], format: "uuid" }
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
