import type { CreateTicketInput, TicketReplyStatus, TicketStatus } from "./ticket-contract.js";

export type { CreateTicketInput } from "./ticket-contract.js";

export interface TicketRecord {
  id: string;
  title: string;
  description: string;
  setup: string;
  additionalInformation: string | null;
  status: TicketStatus;
  replyStatus?: TicketReplyStatus;
  creatorUserId?: string | null;
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

export type ReplyCreationResult =
  | { type: "created"; reply: ReplyRecord }
  | { type: "ticket-not-found" }
  | { type: "ticket-closed" };

export type UpdateReplyStatusResult =
  { type: "updated"; ticket: TicketRecord } | { type: "ticket-not-found" } | { type: "not-owner" };

export interface TicketRepository {
  create(input: CreateTicketInput, creator?: TicketCreator | null): Promise<TicketRecord>;
  listRecent(limit: number): Promise<TicketRecord[]>;
  findById(id: string): Promise<TicketRecord | null>;
  createReply(ticketId: string, body: string): Promise<ReplyCreationResult>;
  listRecentReplies(ticketId: string, limit: number): Promise<ReplyRecord[]>;
  updateReplyStatus?(
    ticketId: string,
    ownerUserId: string,
    replyStatus: TicketReplyStatus
  ): Promise<UpdateReplyStatusResult>;
  assignTechnician(
    ticketId: string,
    assignedTechnicianId: string | null
  ): Promise<AssignmentResult>;
}

export interface TicketCreator {
  id: string;
  name: string;
}
