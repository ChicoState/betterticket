import { isTicketStatus, type TicketStatus } from "../tickets/ticket-api.js";

export interface Notification {
  id: string;
  ticketId: string;
  ticketTitle: string;
  previousStatus: TicketStatus;
  newStatus: TicketStatus;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationList {
  notifications: Notification[];
  unreadCount: number;
}

function isNotification(value: unknown): value is Notification {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const notification = value as Record<string, unknown>;

  return (
    typeof notification.id === "string" &&
    typeof notification.ticketId === "string" &&
    typeof notification.ticketTitle === "string" &&
    isTicketStatus(notification.previousStatus) &&
    isTicketStatus(notification.newStatus) &&
    typeof notification.createdAt === "string" &&
    (typeof notification.readAt === "string" || notification.readAt === null)
  );
}

export async function getNotifications(): Promise<NotificationList> {
  const response = await fetch("/api/notifications");

  if (!response.ok) {
    throw new Error("Notification listing failed");
  }

  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("notifications" in body) ||
    !Array.isArray(body.notifications) ||
    !body.notifications.every(isNotification) ||
    !("unreadCount" in body) ||
    typeof body.unreadCount !== "number"
  ) {
    throw new Error("Notification listing returned an invalid response");
  }

  return { notifications: body.notifications, unreadCount: body.unreadCount };
}

export async function markNotificationsRead(): Promise<void> {
  const response = await fetch("/api/notifications/read", { method: "POST" });

  if (!response.ok) {
    throw new Error("Marking notifications read failed");
  }
}
