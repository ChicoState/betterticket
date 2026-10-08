import type { FastifyPluginAsync } from "fastify";

import {
  apiErrorResponseSchema,
  createReplyBodySchema,
  createTicketBodySchema,
  normalizeCreateTicketInput,
  replyListLimit,
  replyListResponseSchema,
  replyResponseSchema,
  ticketListLimit,
  ticketListResponseSchema,
  ticketParamsSchema,
  ticketResponseSchema,
  type ApiError,
  type CreateReplyInput,
  type CreateTicketInput,
  type Reply,
  type ReplyList,
  type Ticket,
  type TicketList,
  type TicketParams
} from "./ticket-contract.js";
import type { ReplyRecord, TicketRecord, TicketRepository } from "./ticket-repository.js";

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

function toReply(reply: ReplyRecord): Reply {
  return {
    ...reply,
    createdAt: reply.createdAt.toISOString()
  };
}

const ticketNotFound: ApiError = {
  error: {
    code: "NOT_FOUND",
    message: "The ticket was not found"
  }
};

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
        return reply.status(404).send(ticketNotFound);
      }

      return toTicket(ticket);
    }
  );

  app.get<{ Params: TicketParams; Reply: ReplyList | ApiError }>(
    "/api/tickets/:id/replies",
    {
      schema: {
        params: ticketParamsSchema,
        response: {
          200: replyListResponseSchema,
          400: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const ticket = await ticketRepository.findById(request.params.id);

      if (!ticket) {
        return reply.status(404).send(ticketNotFound);
      }

      const replies = await ticketRepository.listRecentReplies(ticket.id, replyListLimit);

      return { replies: replies.map(toReply) };
    }
  );

  app.post<{ Params: TicketParams; Body: CreateReplyInput; Reply: Reply | ApiError }>(
    "/api/tickets/:id/replies",
    {
      schema: {
        params: ticketParamsSchema,
        body: createReplyBodySchema,
        response: {
          201: replyResponseSchema,
          400: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const ticket = await ticketRepository.findById(request.params.id);

      if (!ticket) {
        return reply.status(404).send(ticketNotFound);
      }

      const created = await ticketRepository.createReply(ticket.id, request.body.body.trim());

      return reply.status(201).send(toReply(created));
    }
  );
};
