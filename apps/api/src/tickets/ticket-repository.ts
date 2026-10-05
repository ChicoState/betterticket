import type { CreateTicketInput, TicketStatus } from "./ticket-contract.js";

export type { CreateTicketInput } from "./ticket-contract.js";

export interface TicketRecord {
  id: string;
  title: string;
  description: string;
  setup: string;
  additionalInformation: string | null;
  ownerId: string | null;
  solutionCommentId: string | null;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketRepository {
  create(input: CreateTicketInput, ownerId: string): Promise<TicketRecord>;
  list(): Promise<TicketRecord[]>;
  findById(id: string): Promise<TicketRecord | null>;
  setSolution(ticketId: string, commentId: string | null): Promise<TicketRecord | null>;
}
