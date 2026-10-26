import type { TicketStatus } from "../tickets/ticket-contract.js";

export const emailStatusOptions = [
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "RESOLVED"
] as const satisfies readonly TicketStatus[];

export type EmailStatusOption = (typeof emailStatusOptions)[number];

export interface NotificationSettings {
  email: string | null;
  emailEnabled: boolean;
  emailStatuses: EmailStatusOption[];
}

export const defaultNotificationSettings: NotificationSettings = {
  email: null,
  emailEnabled: false,
  emailStatuses: ["RESOLVED"]
};

const notificationSettingsProperties = {
  // Surrounding whitespace is trimmed and a blank value is stored as null after validation.
  email: {
    anyOf: [
      { type: "string", maxLength: 254, pattern: "^\\s*([^\\s@]+@[^\\s@]+\\.[^\\s@]+)?\\s*$" },
      { type: "null" }
    ]
  },
  emailEnabled: { type: "boolean" },
  emailStatuses: {
    type: "array",
    uniqueItems: true,
    maxItems: emailStatusOptions.length,
    items: { type: "string", enum: emailStatusOptions }
  }
} as const;

export const notificationSettingsBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["email", "emailEnabled", "emailStatuses"],
  properties: notificationSettingsProperties
} as const;

export const notificationSettingsResponseSchema = notificationSettingsBodySchema;

export function normalizeNotificationSettings(input: NotificationSettings): NotificationSettings {
  const email = input.email?.trim().toLowerCase() || null;

  return {
    email,
    emailEnabled: input.emailEnabled,
    // Keep a stable order so stored and returned values do not depend on click order.
    emailStatuses: emailStatusOptions.filter((status) => input.emailStatuses.includes(status))
  };
}

export function isNotificationSettingsComplete(settings: NotificationSettings): boolean {
  return !settings.emailEnabled || (settings.email !== null && settings.emailStatuses.length > 0);
}
