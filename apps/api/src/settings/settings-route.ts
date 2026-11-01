import type { FastifyPluginAsync } from "fastify";

import { sessionCookieName } from "../auth/auth-contract.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import { apiErrorResponseSchema, type ApiError } from "../tickets/ticket-contract.js";
import {
  defaultNotificationSettings,
  isNotificationSettingsComplete,
  normalizeNotificationSettings,
  notificationSettingsBodySchema,
  notificationSettingsResponseSchema,
  type NotificationSettings
} from "./settings-contract.js";
import type { SettingsRepository } from "./settings-repository.js";

interface SettingsRoutesOptions {
  authRepository: AuthRepository;
  settingsRepository: SettingsRepository;
}

const authenticationRequired: ApiError = {
  error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required" }
};

const settingsIncomplete: ApiError = {
  error: {
    code: "EMAIL_SETTINGS_INCOMPLETE",
    message: "Email updates need an email address and at least one status"
  }
};

export const settingsRoutes: FastifyPluginAsync<SettingsRoutesOptions> = async (
  app,
  { authRepository, settingsRepository }
) => {
  app.get<{ Reply: NotificationSettings | ApiError }>(
    "/api/settings/notifications",
    {
      schema: {
        response: {
          200: notificationSettingsResponseSchema,
          401: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const token = request.cookies[sessionCookieName];
      const user = token ? await authRepository.findUserBySession(token) : null;

      if (!user) {
        return reply.status(401).send(authenticationRequired);
      }

      return (
        (await settingsRepository.findNotificationSettings(user.id)) ?? defaultNotificationSettings
      );
    }
  );

  app.put<{ Body: NotificationSettings; Reply: NotificationSettings | ApiError }>(
    "/api/settings/notifications",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
          keyGenerator: (request) => request.cookies[sessionCookieName] ?? request.ip
        }
      },
      schema: {
        body: notificationSettingsBodySchema,
        response: {
          200: notificationSettingsResponseSchema,
          400: apiErrorResponseSchema,
          401: apiErrorResponseSchema,
          429: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const token = request.cookies[sessionCookieName];
      const user = token ? await authRepository.findUserBySession(token) : null;

      if (!user) {
        return reply.status(401).send(authenticationRequired);
      }

      const settings = normalizeNotificationSettings(request.body);
      if (!isNotificationSettingsComplete(settings)) {
        return reply.status(400).send(settingsIncomplete);
      }

      return settingsRepository.saveNotificationSettings(user.id, settings);
    }
  );
};
