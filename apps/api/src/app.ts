import Fastify, { type FastifyServerOptions } from "fastify";

import { ticketRoutes } from "./tickets/ticket-route.js";
import type { TicketRepository } from "./tickets/ticket-repository.js";

interface BuildAppOptions {
  ticketRepository: TicketRepository;
  logger?: FastifyServerOptions["logger"];
}

export function buildApp({ ticketRepository, logger = true }: BuildAppOptions) {
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
        message: "The ticket could not be created"
      }
    });
  });

  void app.register(ticketRoutes, { ticketRepository });

  return app;
}
