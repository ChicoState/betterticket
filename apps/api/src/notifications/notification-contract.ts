import { ticketStatuses, type TicketStatus } from "../tickets/ticket-contract.js";

export const notificationListLimit = 20;

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

export const notificationListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["notifications", "unreadCount"],
  properties: {
    notifications: {
      type: "array",
      maxItems: notificationListLimit,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "ticketId",
          "ticketTitle",
          "previousStatus",
          "newStatus",
          "createdAt",
          "readAt"
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          ticketId: { type: "string", format: "uuid" },
          ticketTitle: { type: "string" },
          previousStatus: { type: "string", enum: ticketStatuses },
          newStatus: { type: "string", enum: ticketStatuses },
          createdAt: { type: "string", format: "date-time" },
          readAt: { type: ["string", "null"], format: "date-time" }
        }
      }
    },
    unreadCount: { type: "integer", minimum: 0 }
  }
} as const;
