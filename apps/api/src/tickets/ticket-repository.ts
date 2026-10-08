import type { CreateTicketInput, TicketStatus } from "./ticket-contract.js";

export type { CreateTicketInput } from "./ticket-contract.js";

export interface TicketRecord {
  id: string;
  title: string;
  description: string;
  setup: string;
  additionalInformation: string | null;
  status: TicketStatus;
  assignedTechnicianId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplyRecord {
  id: string;
  ticketId: string;
  body: string;
  createdAt: Date;
}

export type AssignmentResult =
  | { type: "updated"; ticket: TicketRecord }
  | { type: "ticket-not-found" }
  | { type: "invalid-technician" };

export interface TicketRepository {
  create(input: CreateTicketInput): Promise<TicketRecord>;
  listRecent(limit: number): Promise<TicketRecord[]>;
  findById(id: string): Promise<TicketRecord | null>;
  createReply(ticketId: string, body: string): Promise<ReplyRecord>;
  listRecentReplies(ticketId: string, limit: number): Promise<ReplyRecord[]>;
  assignTechnician(
    ticketId: string,
    assignedTechnicianId: string | null
  ): Promise<AssignmentResult>;
}
