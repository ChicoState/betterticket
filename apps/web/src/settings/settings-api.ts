import type { TicketStatus } from "../tickets/ticket-api.js";

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

export class SettingsApiError extends Error {}

function isEmailStatusOption(value: unknown): value is EmailStatusOption {
  return typeof value === "string" && emailStatusOptions.includes(value as EmailStatusOption);
}

function isNotificationSettings(value: unknown): value is NotificationSettings {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const settings = value as Record<string, unknown>;
  return (
    (typeof settings.email === "string" || settings.email === null) &&
    typeof settings.emailEnabled === "boolean" &&
    Array.isArray(settings.emailStatuses) &&
    settings.emailStatuses.every(isEmailStatusOption)
  );
}

async function readSettings(response: Response): Promise<NotificationSettings> {
  const body: unknown = await response.json();
  if (!isNotificationSettings(body)) {
    throw new SettingsApiError("Notification settings returned an invalid response");
  }

  return body;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const response = await fetch("/api/settings/notifications");

  if (!response.ok) {
    throw new SettingsApiError("Notification settings could not be loaded");
  }

  return readSettings(response);
}

export async function saveNotificationSettings(
  settings: NotificationSettings
): Promise<NotificationSettings> {
  const response = await fetch("/api/settings/notifications", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(settings)
  });

  if (!response.ok) {
    if (response.status === 400) {
      throw new SettingsApiError("Check your email address and selected statuses.");
    }
    if (response.status === 429) {
      throw new SettingsApiError("Please wait a moment before saving again.");
    }
    throw new SettingsApiError("We couldn't save your settings. Please try again.");
  }

  return readSettings(response);
}
