import type {
  CreateTicketInput,
  ReplyKind,
  TicketPriority,
  TicketReplyStatus,
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
  replyStatus?: TicketReplyStatus;
  priority: TicketPriority;
  visibility: TicketVisibility;
  creatorUserId: string | null;
  assignedTechnicianId: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAttachmentRecord {
  id: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface AttachmentRecord extends NewAttachmentRecord {
  ticketId: string;
  createdAt: Date;
}

export interface EndorsementRecord {
  id: string;
  technicianId: string;
  technicianName: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplyRecord {
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

export type ReplyCreationResult =
  | { type: "created"; reply: ReplyRecord }
  | { type: "ticket-not-found" }
  | { type: "ticket-closed" };

export type UpdateReplyStatusResult =
  { type: "updated"; ticket: TicketRecord } | { type: "ticket-not-found" } | { type: "not-owner" };

export type StatusUpdateResult =
  | { type: "updated"; ticket: TicketRecord }
  | { type: "unchanged"; ticket: TicketRecord }
  | { type: "ticket-not-found" }
  | { type: "invalid-transition" };

export interface TicketRepository {
  create(
    input: CreateTicketInput,
    creator?: TicketCreator | null,
    attachments?: NewAttachmentRecord[]
  ): Promise<TicketRecord>;
  listRecent(
    limit: number,
    viewer?: TicketViewer | null,
    sort?: TicketSort
  ): Promise<TicketRecord[]>;
  findById(id: string): Promise<TicketRecord | null>;
  /** Present on repositories used by the attachment routes; optional for focused legacy test fakes. */
  listAttachments?(ticketId: string): Promise<AttachmentRecord[]>;
  /** Present on repositories used by the attachment routes; optional for focused legacy test fakes. */
  findAttachment?(ticketId: string, attachmentId: string): Promise<AttachmentRecord | null>;
  createReply(ticketId: string, body: string, kind?: ReplyKind): Promise<ReplyCreationResult>;
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
