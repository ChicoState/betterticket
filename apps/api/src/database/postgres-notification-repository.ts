import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { notifications, tickets } from "./schema.js";
import type {
  NotificationRecord,
  NotificationRepository
} from "../notifications/notification-repository.js";

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async listRecent(
    userId: string,
    limit: number
  ): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
    const recent = await this.database
      .select({
        id: notifications.id,
        ticketId: notifications.ticketId,
        ticketTitle: tickets.title,
        previousStatus: notifications.previousStatus,
        newStatus: notifications.newStatus,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt
      })
      .from(notifications)
      .innerJoin(tickets, eq(notifications.ticketId, tickets.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit);

    const [unread] = await this.database
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return { notifications: recent, unreadCount: unread?.count ?? 0 };
  }

  async markAllRead(userId: string): Promise<void> {
    await this.database
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }
}
