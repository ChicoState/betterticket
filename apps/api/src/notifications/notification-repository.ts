import type { TicketStatus } from "../tickets/ticket-contract.js";

export interface NotificationRecord {
  id: string;
  ticketId: string;
  ticketTitle: string;
  previousStatus: TicketStatus;
  newStatus: TicketStatus;
  createdAt: Date;
  readAt: Date | null;
}

export interface NotificationRepository {
  listRecent(
    userId: string,
    limit: number
  ): Promise<{ notifications: NotificationRecord[]; unreadCount: number }>;
  markAllRead(userId: string): Promise<void>;
}
