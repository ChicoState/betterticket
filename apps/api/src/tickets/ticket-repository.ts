import type { CreateTicketInput, TicketStatus } from "./ticket-contract.js";

export type { CreateTicketInput } from "./ticket-contract.js";

export interface TicketRecord {
  id: string;
  title: string;
  description: string;
  setup: string;
  additionalInformation: string | null;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplyRecord {
  id: string;
  ticketId: string;
  body: string;
  createdAt: Date;
}

export interface TicketRepository {
  create(input: CreateTicketInput): Promise<TicketRecord>;
  listRecent(limit: number): Promise<TicketRecord[]>;
  findById(id: string): Promise<TicketRecord | null>;
  createReply(ticketId: string, body: string): Promise<ReplyRecord>;
  listRecentReplies(ticketId: string, limit: number): Promise<ReplyRecord[]>;
}
