import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { notificationSettings } from "./schema.js";
import {
  emailStatusOptions,
  type EmailStatusOption,
  type NotificationSettings
} from "../settings/settings-contract.js";
import type { SettingsRepository } from "../settings/settings-repository.js";

const settingsColumns = {
  email: notificationSettings.email,
  emailEnabled: notificationSettings.emailEnabled,
  emailStatuses: notificationSettings.emailStatuses
};

export class PostgresSettingsRepository implements SettingsRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async findNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    const [settings] = await this.database
      .select(settingsColumns)
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1);

    return settings ? toNotificationSettings(settings) : null;
  }

  async saveNotificationSettings(
    userId: string,
    settings: NotificationSettings
  ): Promise<NotificationSettings> {
    const values = { ...settings, updatedAt: new Date() };
    const [saved] = await this.database
      .insert(notificationSettings)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: notificationSettings.userId, set: values })
      .returning(settingsColumns);

    if (!saved) {
      throw new Error("Notification settings upsert did not return a row");
    }

    return toNotificationSettings(saved);
  }
}

function toNotificationSettings(
  settings: Omit<NotificationSettings, "emailStatuses"> & { emailStatuses: string[] }
): NotificationSettings {
  return {
    email: settings.email,
    emailEnabled: settings.emailEnabled,
    emailStatuses: emailStatusOptions.filter((status: EmailStatusOption) =>
      settings.emailStatuses.includes(status)
    )
  };
}
