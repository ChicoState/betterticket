import type { FastifyPluginAsync } from "fastify";

import {
  apiErrorResponseSchema,
  createTicketBodySchema,
  normalizeCreateTicketInput,
  ticketListLimit,
  ticketListResponseSchema,
  ticketResponseSchema,
  type CreateTicketInput,
  type Ticket,
  type TicketList
} from "./ticket-contract.js";
import type { TicketRecord, TicketRepository } from "./ticket-repository.js";

interface TicketRoutesOptions {
  ticketRepository: TicketRepository;
}

function toTicket(ticket: TicketRecord): Ticket {
  return {
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString()
  };
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

      return reply.status(201).send(toTicket(ticket));
    }
  );

  app.get<{ Reply: TicketList }>(
    "/api/tickets",
    {
      schema: {
        response: {
          200: ticketListResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async () => {
      const tickets = await ticketRepository.listRecent(ticketListLimit);

      return { tickets: tickets.map(toTicket) };
    }
  );
};
