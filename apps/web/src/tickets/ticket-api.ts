export interface CreateTicketInput {
  title: string;
  description: string;
  setup: string;
  additionalInformation?: string;
}

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
  createdAt: string;
  updatedAt: string;
}

function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && ticketStatuses.includes(value as TicketStatus);
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
    typeof ticket.createdAt === "string" &&
    typeof ticket.updatedAt === "string"
  );
}

export async function listTickets(): Promise<Ticket[]> {
  const response = await fetch("/api/tickets");

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
