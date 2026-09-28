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

export interface TicketRepository {
  create(input: CreateTicketInput): Promise<TicketRecord>;
}
