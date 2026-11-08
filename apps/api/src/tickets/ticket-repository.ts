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
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type VoteValue = -1 | 1;

export interface VoteState {
  upvotes: number;
  downvotes: number;
  userVote: VoteValue | null;
}

export type SetReplyVoteResult = { type: "updated"; vote: VoteState } | { type: "reply-not-found" };

export interface ReplyRecord extends VoteState {
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

export type SetTicketVoteResult =
  { type: "updated"; vote: VoteState } | { type: "ticket-not-found" };

export interface TicketRepository {
  listTicketVotes(
    ticketIds: string[],
    userId?: string
  ): Promise<Array<VoteState & { ticketId: string }>>;
  getTicketVote(ticketId: string, userId?: string): Promise<VoteState | null>;
  setTicketVote(
    ticketId: string,
    userId: string,
    value: VoteValue | null
  ): Promise<SetTicketVoteResult>;
  create(input: CreateTicketInput, creator?: TicketCreator | null): Promise<TicketRecord>;
  listRecent(limit: number): Promise<TicketRecord[]>;
  findById(id: string): Promise<TicketRecord | null>;
  createReply(ticketId: string, body: string): Promise<ReplyRecord>;
  listRecentReplies(ticketId: string, limit: number, userId?: string): Promise<ReplyRecord[]>;
  setReplyVote(
    ticketId: string,
    replyId: string,
    userId: string,
    value: VoteValue | null
  ): Promise<SetReplyVoteResult>;
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
