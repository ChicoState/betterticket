import type { NotificationSettings } from "./settings-contract.js";

export interface SettingsRepository {
  findNotificationSettings(userId: string): Promise<NotificationSettings | null>;
  saveNotificationSettings(
    userId: string,
    settings: NotificationSettings
  ): Promise<NotificationSettings>;
}
