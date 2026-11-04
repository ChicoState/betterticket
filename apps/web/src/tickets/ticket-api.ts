export interface CreateTicketInput {
  title: string;
  description: string;
  setup: string;
  additionalInformation?: string;
  postAnonymously?: boolean;
  priority?: TicketPriority;
  visibility?: TicketVisibility;
}

export const ticketPriorities = ["LOW", "MEDIUM", "HIGH"] as const;
export type TicketPriority = (typeof ticketPriorities)[number];
export const ticketSorts = ["newest", "priority"] as const;
export type TicketSort = (typeof ticketSorts)[number];

export const ticketVisibilities = ["PUBLIC", "AUTHENTICATED", "PRIVATE"] as const;
export type TicketVisibility = (typeof ticketVisibilities)[number];

export const ticketStatuses = [
  "OPEN",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "COMPLETED"
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export interface CreatedTicket {
  id: string;
}

function isCreatedTicket(value: unknown): value is CreatedTicket {
  return (
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"
  );
}

export async function createTicket(input: CreateTicketInput): Promise<CreatedTicket> {
  const response = await fetch("/api/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Ticket creation failed");
  }

  const body: unknown = await response.json();
  if (!isCreatedTicket(body)) {
    throw new Error("Ticket creation returned an invalid response");
  }

  return body;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  setup: string;
  additionalInformation: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  visibility: TicketVisibility;
  canReply: boolean;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export class TicketStatusUpdateError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined
  ) {
    super(message);
    this.name = "TicketStatusUpdateError";
  }
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && ticketStatuses.includes(value as TicketStatus);
}

function isTicketPriority(value: unknown): value is TicketPriority {
  return typeof value === "string" && ticketPriorities.includes(value as TicketPriority);
}

function isTicket(value: unknown): value is Ticket {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const ticket = value as Record<string, unknown>;

  return (
    typeof ticket.id === "string" &&
    typeof ticket.title === "string" &&
    typeof ticket.description === "string" &&
    typeof ticket.setup === "string" &&
    (typeof ticket.additionalInformation === "string" || ticket.additionalInformation === null) &&
    isTicketStatus(ticket.status) &&
    isTicketPriority(ticket.priority) &&
    ticketVisibilities.includes(ticket.visibility as TicketVisibility) &&
    typeof ticket.canReply === "boolean" &&
    (typeof ticket.createdByName === "string" || ticket.createdByName === null) &&
    typeof ticket.createdAt === "string" &&
    typeof ticket.updatedAt === "string"
  );
}

export async function listTickets(sort: TicketSort = "newest"): Promise<Ticket[]> {
  const response = await fetch(sort === "priority" ? "/api/tickets?sort=priority" : "/api/tickets");

  if (!response.ok) {
    throw new Error("Ticket listing failed");
  }

  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("tickets" in body) ||
    !Array.isArray(body.tickets) ||
    !body.tickets.every(isTicket)
  ) {
    throw new Error("Ticket listing returned an invalid response");
  }

  return body.tickets;
}

export function ticketPath(id: string): string {
  return `/tickets/${encodeURIComponent(id)}`;
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const response = await fetch(`/api/tickets/${encodeURIComponent(id)}`);

  // A malformed ID is rejected with 400; to a visitor that is the same as a missing ticket.
  if (response.status === 404 || response.status === 400) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Ticket lookup failed");
  }

  const body: unknown = await response.json();
  if (!isTicket(body)) {
    throw new Error("Ticket lookup returned an invalid response");
  }

  return body;
}

function isApiError(value: unknown): value is { error: { code?: unknown; message?: unknown } } {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }

  const error = value.error;
  return typeof error === "object" && error !== null;
}

async function readApiError(
  response: Response,
  fallbackMessage: string
): Promise<{ code: string | undefined; message: string }> {
  try {
    const body: unknown = await response.json();
    if (isApiError(body)) {
      const error = body.error as { code?: unknown; message?: unknown };
      return {
        code: typeof error.code === "string" ? error.code : undefined,
        message: typeof error.message === "string" ? error.message : fallbackMessage
      };
    }
  } catch {
    // Use the stable client message when the server does not return JSON.
  }

  return { code: undefined, message: fallbackMessage };
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<Ticket> {
  const response = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    const { code, message } = await readApiError(response, "Ticket status update failed");
    throw new TicketStatusUpdateError(message, response.status, code);
  }

  const body: unknown = await response.json();
  if (!isTicket(body)) {
    throw new Error("Ticket status update returned an invalid response");
  }

  return body;
}

export const replyKinds = ["SOLUTION", "COMMENT"] as const;
export type ReplyKind = (typeof replyKinds)[number];

export interface Endorsement {
  id: string;
  technicianName: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  isOwn: boolean;
}

export interface Reply {
  id: string;
  kind: ReplyKind;
  body: string;
  createdAt: string;
  endorsements: Endorsement[];
}

function isEndorsement(value: unknown): value is Endorsement {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const endorsement = value as Record<string, unknown>;

  return (
    typeof endorsement.id === "string" &&
    typeof endorsement.technicianName === "string" &&
    (typeof endorsement.notes === "string" || endorsement.notes === null) &&
    typeof endorsement.createdAt === "string" &&
    typeof endorsement.updatedAt === "string" &&
    typeof endorsement.isOwn === "boolean"
  );
}

function isReply(value: unknown): value is Reply {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const reply = value as Record<string, unknown>;

  return (
    typeof reply.id === "string" &&
    replyKinds.includes(reply.kind as ReplyKind) &&
    typeof reply.body === "string" &&
    typeof reply.createdAt === "string" &&
    Array.isArray(reply.endorsements) &&
    reply.endorsements.every(isEndorsement)
  );
}

function repliesUrl(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}/replies`;
}

export async function listReplies(ticketId: string): Promise<Reply[]> {
  const response = await fetch(repliesUrl(ticketId));

  if (!response.ok) {
    throw new Error("Reply listing failed");
  }

  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("replies" in body) ||
    !Array.isArray(body.replies) ||
    !body.replies.every(isReply)
  ) {
    throw new Error("Reply listing returned an invalid response");
  }

  return body.replies;
}

export async function createReply(ticketId: string, body: string, kind: ReplyKind): Promise<Reply> {
  const response = await fetch(repliesUrl(ticketId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body, kind })
  });

  if (!response.ok) {
    throw new Error("Reply creation failed");
  }

  const reply: unknown = await response.json();
  if (!isReply(reply)) {
    throw new Error("Reply creation returned an invalid response");
  }

  return reply;
}

export class EndorsementError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined
  ) {
    super(message);
    this.name = "EndorsementError";
  }
}

export interface EndorseReplyInput {
  notes: string;
  markResolved: boolean;
}

function endorsementUrl(ticketId: string, replyId: string): string {
  return `${repliesUrl(ticketId)}/${encodeURIComponent(replyId)}/endorsement`;
}

export async function endorseReply(
  ticketId: string,
  replyId: string,
  input: EndorseReplyInput
): Promise<{ reply: Reply; ticket: Ticket }> {
  const response = await fetch(endorsementUrl(ticketId, replyId), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const { code, message } = await readApiError(response, "Endorsement failed");
    throw new EndorsementError(message, response.status, code);
  }

  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("reply" in body) ||
    !("ticket" in body) ||
    !isReply(body.reply) ||
    !isTicket(body.ticket)
  ) {
    throw new Error("Endorsement returned an invalid response");
  }

  return { reply: body.reply, ticket: body.ticket };
}

export async function withdrawEndorsement(ticketId: string, replyId: string): Promise<void> {
  const response = await fetch(endorsementUrl(ticketId, replyId), { method: "DELETE" });

  if (!response.ok) {
    const { code, message } = await readApiError(response, "Endorsement withdrawal failed");
    throw new EndorsementError(message, response.status, code);
  }
}
