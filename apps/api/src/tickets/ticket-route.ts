import type { FastifyPluginAsync } from "fastify";

import {
  apiErrorResponseSchema,
  createTicketBodySchema,
  normalizeCreateTicketInput,
  ticketResponseSchema,
  type CreateTicketInput,
  type Ticket
} from "./ticket-contract.js";
import type { TicketRepository } from "./ticket-repository.js";

interface TicketRoutesOptions {
  ticketRepository: TicketRepository;
}

export const ticketRoutes: FastifyPluginAsync<TicketRoutesOptions> = async (
  app,
  { ticketRepository }
) => {
  app.post<{ Body: CreateTicketInput; Reply: Ticket }>(
    "/api/tickets",
    {
      schema: {
        body: createTicketBodySchema,
        response: {
          201: ticketResponseSchema,
          400: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const ticket = await ticketRepository.create(normalizeCreateTicketInput(request.body));

      return reply.status(201).send({
        ...ticket,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString()
      });
    }
  );
};
