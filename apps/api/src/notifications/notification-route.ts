import type { FastifyPluginAsync } from "fastify";

import { sessionCookieName } from "../auth/auth-contract.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import { apiErrorResponseSchema, type ApiError } from "../tickets/ticket-contract.js";
import {
  notificationListLimit,
  notificationListResponseSchema,
  type NotificationList
} from "./notification-contract.js";
import type { NotificationRepository } from "./notification-repository.js";

interface NotificationRoutesOptions {
  authRepository: AuthRepository;
  notificationRepository: NotificationRepository;
}

const authenticationRequired: ApiError = {
  error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required" }
};

export const notificationRoutes: FastifyPluginAsync<NotificationRoutesOptions> = async (
  app,
  { authRepository, notificationRepository }
) => {
  app.get<{ Reply: NotificationList | ApiError }>(
    "/api/notifications",
    {
      schema: {
        response: {
          200: notificationListResponseSchema,
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

      const { notifications, unreadCount } = await notificationRepository.listRecent(
        user.id,
        notificationListLimit
      );

      return {
        notifications: notifications.map((notification) => ({
          ...notification,
          createdAt: notification.createdAt.toISOString(),
          readAt: notification.readAt?.toISOString() ?? null
        })),
        unreadCount
      };
    }
  );

  app.post(
    "/api/notifications/read",
    {
      schema: {
        response: {
          204: { type: "null" },
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

      await notificationRepository.markAllRead(user.id);

      return reply.status(204).send();
    }
  );
};
