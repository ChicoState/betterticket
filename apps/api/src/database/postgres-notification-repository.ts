import { and, desc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { comments, notificationPreferences, notifications, tickets } from "./schema.js";
import type {
  NotificationEvent,
  NotificationRecord,
  NotificationRepository
} from "../notifications/notification-repository.js";

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async isParticipant(ticketId: string, userId: string): Promise<boolean> {
    const [ticket] = await this.database
      .select({ ownerId: tickets.ownerId })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    if (ticket?.ownerId === userId) return true;
    const authored = await this.database
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.authorId, userId), eq(comments.ticketId, ticketId)));
    return authored.length > 0;
  }

  async upsertPreference(input: {
    userId: string;
    ticketId: string;
    event: NotificationEvent;
    inAppEnabled: boolean;
    emailEnabled: boolean;
  }): Promise<void> {
    await this.database
      .insert(notificationPreferences)
      .values(input)
      .onConflictDoUpdate({
        target: [
          notificationPreferences.userId,
          notificationPreferences.ticketId,
          notificationPreferences.event
        ],
        set: { inAppEnabled: input.inAppEnabled, emailEnabled: input.emailEnabled }
      });
  }

  async listForUser(userId: string): Promise<NotificationRecord[]> {
    return this.database
      .select({
        id: notifications.id,
        ticketId: notifications.ticketId,
        commentId: notifications.commentId,
        event: notifications.event,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async notifyParticipants(input: {
    ticketId: string;
    commentId?: string;
    event: NotificationEvent;
    actorId: string;
  }): Promise<void> {
    const [ticket] = await this.database
      .select({ ownerId: tickets.ownerId })
      .from(tickets)
      .where(eq(tickets.id, input.ticketId));
    const authors = await this.database
      .select({ authorId: comments.authorId })
      .from(comments)
      .where(eq(comments.ticketId, input.ticketId));
    const recipients = [
      ...new Set(
        [ticket?.ownerId, ...authors.map((author) => author.authorId)].filter(
          (id): id is string => Boolean(id) && id !== input.actorId
        )
      )
    ];
    if (recipients.length === 0) return;
    const preferences = await this.database
      .select()
      .from(notificationPreferences)
      .where(inArray(notificationPreferences.userId, recipients));
    const optedIn = preferences.filter(
      (preference) =>
        preference.ticketId === input.ticketId &&
        preference.event === input.event &&
        (preference.inAppEnabled || preference.emailEnabled)
    );
    if (optedIn.length)
      await this.database.insert(notifications).values(
        optedIn.map((preference) => ({
          userId: preference.userId,
          ticketId: input.ticketId,
          commentId: input.commentId,
          event: input.event,
          emailPending: preference.emailEnabled
        }))
      );
  }
}
