import { voteStateResponseSchema } from "./vote-contract.js";
export const ticketStatuses = [
  "OPEN",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "COMPLETED"
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export const ticketReplyStatuses = ["OPEN", "CLOSED"] as const;

export type TicketReplyStatus = (typeof ticketReplyStatuses)[number];

export const ticketPriorities = ["LOW", "MEDIUM", "HIGH"] as const;

export type TicketPriority = (typeof ticketPriorities)[number];

export const ticketSorts = ["votes", "newest", "priority"] as const;

export type TicketSort = (typeof ticketSorts)[number];

/**
 * Technicians may only advance a ticket one stage at a time and never close it; the owner
 * confirms completion.
 */
export function canTechnicianChangeStatus(from: TicketStatus, to: TicketStatus): boolean {
  return to !== "COMPLETED" && ticketStatuses.indexOf(to) === ticketStatuses.indexOf(from) + 1;
}

export const ticketVisibilities = ["PUBLIC", "AUTHENTICATED", "PRIVATE"] as const;
export type TicketVisibility = (typeof ticketVisibilities)[number];

export interface CreateTicketInput {
  title: string;
  description: string;
  setup: string;
  additionalInformation?: string;
  postAnonymously?: boolean;
  priority?: TicketPriority;
  visibility?: TicketVisibility;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  setup: string;
  additionalInformation: string | null;
  status: TicketStatus;
  replyStatus: TicketReplyStatus;
  canManageReplyStatus: boolean;
  priority: TicketPriority;
  visibility: TicketVisibility;
  canReply: boolean;
  assignedTechnicianId: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketAssignmentParams {
  ticketId: string;
}

export interface AssignTechnicianInput {
  assignedTechnicianId: string | null;
}

export interface UpdateTicketReplyStatusInput {
  replyStatus: TicketReplyStatus;
}

export interface UpdateTicketStatusInput {
  status: TicketStatus;
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
    additionalInformation: requiredText(3_000),
    postAnonymously: { type: "boolean" },
    priority: { type: "string", enum: ticketPriorities },
    visibility: { type: "string", enum: ticketVisibilities }
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
    "replyStatus",
    "canManageReplyStatus",
    "priority",
    "visibility",
    "canReply",
    "assignedTechnicianId",
    "createdByName",
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
    replyStatus: { type: "string", enum: ticketReplyStatuses },
    canManageReplyStatus: { type: "boolean" },
    priority: { type: "string", enum: ticketPriorities },
    visibility: { type: "string", enum: ticketVisibilities },
    canReply: { type: "boolean" },
    assignedTechnicianId: { type: ["string", "null"], format: "uuid" },
    createdByName: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" }
  }
} as const;

export const ticketListLimit = 100;

export interface TicketList {
  tickets: Array<
    Ticket & { votes: { upvotes: number; downvotes: number; userVote: -1 | 1 | null } }
  >;
}

export const ticketListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tickets"],
  properties: {
    tickets: {
      type: "array",
      maxItems: ticketListLimit,
      items: {
        ...ticketResponseSchema,
        required: [...ticketResponseSchema.required, "votes"],
        properties: { ...ticketResponseSchema.properties, votes: voteStateResponseSchema }
      }
    }
  }
} as const;

export const ticketListQuerySchema = {
  type: "object",
  properties: {
    sort: { type: "string", enum: ticketSorts, default: "votes" }
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

export const updateTicketReplyStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["replyStatus"],
  properties: {
    replyStatus: { type: "string", enum: ticketReplyStatuses }
  }
} as const;

export const replyKinds = ["SOLUTION", "COMMENT"] as const;
export type ReplyKind = (typeof replyKinds)[number];

export interface CreateReplyInput {
  body: string;
  kind?: ReplyKind;
}

export interface Endorsement {
  id: string;
  technicianName: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  isOwn: boolean;
}

export interface Reply {
  upvotes: number;
  downvotes: number;
  userVote: -1 | 1 | null;
  id: string;
  ticketId: string;
  kind: ReplyKind;
  body: string;
  createdAt: string;
  endorsements: Endorsement[];
}

export const createReplyBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["body"],
  properties: {
    body: requiredText(5_000),
    kind: { type: "string", enum: replyKinds }
  }
} as const;

export const endorsementResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "technicianName", "notes", "createdAt", "updatedAt", "isOwn"],
  properties: {
    id: { type: "string", format: "uuid" },
    technicianName: { type: "string" },
    notes: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    isOwn: { type: "boolean" }
  }
} as const;

export const replyResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "ticketId",
    "kind",
    "body",
    "createdAt",
    "endorsements",
    "upvotes",
    "downvotes",
    "userVote"
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    upvotes: { type: "integer", minimum: 0 },
    downvotes: { type: "integer", minimum: 0 },
    userVote: { enum: [-1, 1, null] },
    ticketId: { type: "string", format: "uuid" },
    kind: { type: "string", enum: replyKinds },
    body: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    endorsements: { type: "array", items: endorsementResponseSchema }
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

export const updateTicketStatusBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: { type: "string", enum: ticketStatuses }
  }
} as const;

export interface ReplyEndorsementParams {
  ticketId: string;
  replyId: string;
}

export const replyEndorsementParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId", "replyId"],
  properties: {
    ticketId: { type: "string", format: "uuid" },
    replyId: { type: "string", format: "uuid" }
  }
} as const;

export const endorsementNotesMaxLength = 2_000;

export interface EndorseReplyInput {
  notes?: string;
  markResolved?: boolean;
}

export const endorseReplyBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    notes: { type: "string", maxLength: endorsementNotesMaxLength },
    markResolved: { type: "boolean" }
  }
} as const;

export interface EndorsementUpdate {
  reply: Reply;
  ticket: Ticket;
}

export const endorsementUpdateResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "ticket"],
  properties: {
    reply: replyResponseSchema,
    ticket: ticketResponseSchema
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
      : { additionalInformation: input.additionalInformation.trim() }),
    ...(input.postAnonymously === undefined ? {} : { postAnonymously: input.postAnonymously }),
    ...(input.priority === undefined
      ? { priority: "MEDIUM" as const }
      : { priority: input.priority }),
    ...(input.visibility === undefined ? {} : { visibility: input.visibility })
  };
}
