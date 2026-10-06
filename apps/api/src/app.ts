import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyServerOptions } from "fastify";

import { authRoutes } from "./auth/auth-route.js";
import type { AuthRepository } from "./auth/auth-repository.js";
import { ticketRoutes } from "./tickets/ticket-route.js";
import type { TicketRepository } from "./tickets/ticket-repository.js";

interface BuildAppOptions {
  authRepository: AuthRepository;
  ticketRepository: TicketRepository;
  logger?: FastifyServerOptions["logger"];
}

export function buildApp({ authRepository, ticketRepository, logger = true }: BuildAppOptions) {
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
      const isTicketCreation =
        request.method === "POST" && request.routeOptions.url === "/api/tickets";
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: isTicketCreation ? "Ticket details are invalid" : "Request details are invalid"
        }
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      error.statusCode === 429
    ) {
      return reply.status(429).send({
        error: { code: "RATE_LIMITED", message: "Too many login attempts" }
      });
    }

    request.log.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "request failed"
    );
    const isTicketCreation =
      request.method === "POST" && request.routeOptions.url === "/api/tickets";
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: isTicketCreation
          ? "The ticket could not be created"
          : "The request could not be completed"
      }
    });
  });

  void app.register(cookie);
  void app.register(rateLimit, { global: false });
  void app.register(authRoutes, { authRepository });
  void app.register(ticketRoutes, { authRepository, ticketRepository });

  return app;
}
