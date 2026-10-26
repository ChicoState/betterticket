import type { CreateTicketInput, TicketStatus, TicketVisibility } from "./ticket-contract.js";

export type { CreateTicketInput } from "./ticket-contract.js";

export interface TicketRecord {
  id: string;
  title: string;
  description: string;
  setup: string;
  additionalInformation: string | null;
  status: TicketStatus;
  visibility: TicketVisibility;
  creatorUserId: string | null;
  assignedTechnicianId: string | null;
  createdByName: string | null;
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

export type StatusUpdateResult =
  | { type: "updated"; ticket: TicketRecord }
  | { type: "unchanged"; ticket: TicketRecord }
  | { type: "ticket-not-found" }
  | { type: "invalid-transition" };

export interface TicketRepository {
  create(input: CreateTicketInput, creator?: TicketCreator | null): Promise<TicketRecord>;
  listRecent(limit: number, viewer?: TicketViewer | null): Promise<TicketRecord[]>;
  findById(id: string): Promise<TicketRecord | null>;
  createReply(ticketId: string, body: string): Promise<ReplyRecord>;
  listRecentReplies(ticketId: string, limit: number): Promise<ReplyRecord[]>;
  assignTechnician(
    ticketId: string,
    assignedTechnicianId: string | null
  ): Promise<AssignmentResult>;
  updateStatus(ticketId: string, status: TicketStatus): Promise<StatusUpdateResult>;
}

export interface TicketCreator {
  id: string;
  name: string;
}

export interface TicketViewer {
  id: string;
  role: "USER" | "TECHNICIAN";
}
