export const notificationEvents = ["COMMENT", "REPLY", "HELPFUL", "SOLUTION"] as const;
export type NotificationEvent = (typeof notificationEvents)[number];

export interface NotificationRecord {
  id: string;
  ticketId: string;
  commentId: string | null;
  event: NotificationEvent;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationRepository {
  isParticipant(ticketId: string, userId: string): Promise<boolean>;
  upsertPreference(input: {
    userId: string;
    ticketId: string;
    event: NotificationEvent;
    inAppEnabled: boolean;
    emailEnabled: boolean;
  }): Promise<void>;
  listForUser(userId: string): Promise<NotificationRecord[]>;
  notifyParticipants(input: {
    ticketId: string;
    commentId?: string;
    event: NotificationEvent;
    actorId: string;
  }): Promise<void>;
}
