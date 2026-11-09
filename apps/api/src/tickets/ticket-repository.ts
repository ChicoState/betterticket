import type {
  CreateTicketInput,
  ReplyKind,
  TicketPriority,
  TicketSort,
  TicketStatus
} from "./ticket-contract.js";
import type { TicketVisibility } from "./ticket-contract.js";

export type { CreateTicketInput } from "./ticket-contract.js";
export type { TicketPriority, TicketSort } from "./ticket-contract.js";

export interface TicketRecord {
  id: string;
  title: string;
  description: string;
  setup: string;
  additionalInformation: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  visibility: TicketVisibility;
  creatorUserId: string | null;
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

export interface EndorsementRecord {
  id: string;
  technicianId: string;
  technicianName: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplyRecord extends VoteState {
  id: string;
  ticketId: string;
  kind: ReplyKind;
  body: string;
  createdAt: Date;
  endorsements: EndorsementRecord[];
}

export interface EndorseReplyRecordInput {
  notes: string | null;
  markResolved: boolean;
}

export type EndorseResult =
  | { type: "endorsed"; reply: ReplyRecord; ticket: TicketRecord }
  | { type: "reply-not-found" }
  | { type: "not-a-solution" }
  | { type: "invalid-transition" };

export type WithdrawResult = { type: "withdrawn" } | { type: "endorsement-not-found" };

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
  listRecent(
    limit: number,
    viewer?: TicketViewer | null,
    sort?: TicketSort
  ): Promise<TicketRecord[]>;
  findById(id: string): Promise<TicketRecord | null>;
  createReply(ticketId: string, body: string, kind?: ReplyKind): Promise<ReplyRecord>;
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
  /** Applies a technician status change and notifies the ticket's creator in one transaction. */
  updateStatus(
    ticketId: string,
    status: TicketStatus,
    actorUserId: string
  ): Promise<StatusUpdateResult>;
  /**
   * Creates or replaces a technician's endorsement of a solution. With `markResolved`, the
   * ticket is moved to RESOLVED through the status rule in the same transaction.
   */
  endorseReply(
    ticketId: string,
    replyId: string,
    technicianId: string,
    input: EndorseReplyRecordInput
  ): Promise<EndorseResult>;
  withdrawEndorsement(
    ticketId: string,
    replyId: string,
    technicianId: string
  ): Promise<WithdrawResult>;
}

export interface TicketCreator {
  id: string;
  name: string;
}

export interface TicketViewer {
  id: string;
  role: "USER" | "TECHNICIAN";
}
