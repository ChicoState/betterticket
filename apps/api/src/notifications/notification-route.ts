import type { FastifyPluginAsync } from "fastify";

import { requireActor } from "../auth/auth-route.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import { notificationEvents, type NotificationRepository } from "./notification-repository.js";

export const notificationRoutes: FastifyPluginAsync<{
  authRepository: AuthRepository;
  notificationRepository: NotificationRepository;
}> = async (app, { authRepository, notificationRepository }) => {
  app.get("/api/notifications", async (request, reply) => {
    const actor = await requireActor(request, reply, authRepository);
    if (!actor) return;
    return (await notificationRepository.listForUser(actor.id)).map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString()
    }));
  });

  app.put<{
    Params: { ticketId: string };
    Body: { event: string; inAppEnabled: boolean; emailEnabled: boolean };
  }>("/api/tickets/:ticketId/notification-preferences", async (request, reply) => {
    const actor = await requireActor(request, reply, authRepository, true);
    if (!actor) return;
    const { event, inAppEnabled, emailEnabled } = request.body;
    if (
      !notificationEvents.includes(event as (typeof notificationEvents)[number]) ||
      typeof inAppEnabled !== "boolean" ||
      typeof emailEnabled !== "boolean"
    )
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Notification preference is invalid" }
      });
    if (!(await notificationRepository.isParticipant(request.params.ticketId, actor.id)))
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: "Only ticket participants may set notification preferences"
        }
      });
    await notificationRepository.upsertPreference({
      userId: actor.id,
      ticketId: request.params.ticketId,
      event: event as (typeof notificationEvents)[number],
      inAppEnabled,
      emailEnabled
    });
    return reply.status(204).send();
  });
};
