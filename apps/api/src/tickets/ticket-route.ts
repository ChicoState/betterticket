import type { FastifyPluginAsync } from "fastify";

import {
  apiErrorResponseSchema,
  createTicketBodySchema,
  normalizeCreateTicketInput,
  ticketListLimit,
  ticketListResponseSchema,
  ticketParamsSchema,
  ticketResponseSchema,
  type ApiError,
  type CreateTicketInput,
  type Ticket,
  type TicketList,
  type TicketParams
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

  app.get<{ Params: TicketParams; Reply: Ticket | ApiError }>(
    "/api/tickets/:id",
    {
      schema: {
        params: ticketParamsSchema,
        response: {
          200: ticketResponseSchema,
          400: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const ticket = await ticketRepository.findById(request.params.id);

      if (!ticket) {
        return reply.status(404).send({
          error: {
            code: "NOT_FOUND",
            message: "The ticket was not found"
          }
        });
      }

      return toTicket(ticket);
    }
  );
};
