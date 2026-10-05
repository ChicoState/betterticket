import Fastify, { type FastifyServerOptions } from "fastify";

import { authRoutes } from "./auth/auth-route.js";
import type { AuthRepository } from "./auth/auth-repository.js";
import { commentRoutes } from "./tickets/comment-route.js";
import type { CommentRepository } from "./tickets/comment-repository.js";
import { notificationRoutes } from "./notifications/notification-route.js";
import type { NotificationRepository } from "./notifications/notification-repository.js";
import { ticketRoutes } from "./tickets/ticket-route.js";
import type { TicketRepository } from "./tickets/ticket-repository.js";

interface BuildAppOptions {
  ticketRepository: TicketRepository;
  commentRepository: CommentRepository;
  authRepository: AuthRepository;
  notificationRepository: NotificationRepository;
  logger?: FastifyServerOptions["logger"];
}

export function buildApp({
  ticketRepository,
  commentRepository,
  authRepository,
  notificationRepository,
  logger = true
}: BuildAppOptions) {
  const app = Fastify({
    logger,
    ajv: {
      customOptions: {
        removeAdditional: false
      }
    }
  });

  app.addHook("onSend", async (_request, reply) => {
    void reply
      .header("x-content-type-options", "nosniff")
      .header("x-frame-options", "DENY")
      .header("referrer-policy", "no-referrer");
  });

  app.setErrorHandler((error, request, reply) => {
    if (typeof error === "object" && error !== null && "validation" in error && error.validation) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Ticket details are invalid"
        }
      });
    }

    request.log.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "ticket request failed"
    );
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed"
      }
    });
  });

  void app.register(authRoutes, { authRepository });
  void app.register(ticketRoutes, { ticketRepository, commentRepository, authRepository });
  void app.register(commentRoutes, {
    ticketRepository,
    commentRepository,
    authRepository,
    notificationRepository
  });
  void app.register(notificationRoutes, { authRepository, notificationRepository });

  return app;
}
