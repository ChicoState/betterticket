import type { FastifyPluginAsync } from "fastify";

import { sessionCookieName } from "../auth/auth-contract.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import { requireTechnician } from "../auth/require-technician.js";
import {
  apiErrorResponseSchema,
  createReplyBodySchema,
  createTicketBodySchema,
  normalizeCreateTicketInput,
  replyListLimit,
  replyListResponseSchema,
  replyResponseSchema,
  assignTechnicianBodySchema,
  ticketAssignmentParamsSchema,
  ticketListLimit,
  ticketListQuerySchema,
  ticketListResponseSchema,
  ticketParamsSchema,
  ticketResponseSchema,
  updateTicketStatusBodySchema,
  type ApiError,
  type CreateReplyInput,
  type AssignTechnicianInput,
  type CreateTicketInput,
  type Reply,
  type ReplyList,
  type Ticket,
  type TicketAssignmentParams,
  type TicketList,
  type TicketSort,
  type TicketParams,
  type UpdateTicketStatusInput
} from "./ticket-contract.js";
import type {
  ReplyRecord,
  TicketRecord,
  TicketRepository,
  TicketViewer
} from "./ticket-repository.js";
import { canAccessTicket } from "./ticket-access.js";

interface TicketRoutesOptions {
  authRepository: AuthRepository;
  ticketRepository: TicketRepository;
}

function toTicket(ticket: TicketRecord, viewer: TicketViewer | null): Ticket {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    setup: ticket.setup,
    additionalInformation: ticket.additionalInformation,
    status: ticket.status,
    priority: ticket.priority,
    visibility: ticket.visibility,
    canReply: canAccessTicket(ticket, viewer),
    assignedTechnicianId: ticket.assignedTechnicianId,
    createdByName: ticket.createdByName,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString()
  };
}

async function currentUser(
  request: { cookies: Record<string, string | undefined> },
  authRepository: AuthRepository
) {
  const token = request.cookies[sessionCookieName];
  return token ? authRepository.findUserBySession(token) : null;
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
  { authRepository, ticketRepository }
) => {
  app.post<{ Body: CreateTicketInput; Reply: Ticket | ApiError }>(
    "/api/tickets",
    {
      schema: {
        body: createTicketBodySchema,
        response: {
          201: ticketResponseSchema,
          400: apiErrorResponseSchema,
          401: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const user = await currentUser(request, authRepository);
      const input = normalizeCreateTicketInput(request.body);
      if ((input.visibility ?? "PUBLIC") !== "PUBLIC" && !user) {
        return reply.status(401).send({
          error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required" }
        });
      }
      const ticket = await ticketRepository.create(input, user);

      return reply.status(201).send(toTicket(ticket, user));
    }
  );

  app.patch<{
    Params: TicketAssignmentParams;
    Body: UpdateTicketStatusInput;
    Reply: Ticket | ApiError;
  }>(
    "/api/tickets/:ticketId/status",
    {
      schema: {
        params: ticketAssignmentParamsSchema,
        body: updateTicketStatusBodySchema,
        response: {
          200: ticketResponseSchema,
          400: apiErrorResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const access = await requireTechnician(authRepository, request);
      if (access.type === "denied") {
        return reply.status(access.statusCode).send(access.body);
      }

      const result = await ticketRepository.updateStatus(
        request.params.ticketId,
        request.body.status
      );

      if (result.type === "ticket-not-found") {
        return reply.status(404).send(ticketNotFound);
      }
      if (result.type === "invalid-transition") {
        return reply.status(400).send({
          error: {
            code: "INVALID_STATUS_TRANSITION",
            message: "The ticket status transition is invalid"
          }
        });
      }

      return reply.status(200).send(toTicket(result.ticket, access.user));
    }
  );

  app.get<{ Querystring: { sort?: TicketSort }; Reply: TicketList }>(
    "/api/tickets",
    {
      schema: {
        querystring: ticketListQuerySchema,
        response: {
          200: ticketListResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request) => {
      const viewer = await currentUser(request, authRepository);
      const tickets = await ticketRepository.listRecent(
        ticketListLimit,
        viewer,
        request.query.sort
      );
      return {
        tickets: tickets
          .filter((ticket) => canAccessTicket(ticket, viewer))
          .map((ticket) => toTicket(ticket, viewer))
      };
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
      const viewer = await currentUser(request, authRepository);

      if (!ticket || !canAccessTicket(ticket, viewer)) {
        return reply.status(404).send(ticketNotFound);
      }

      return toTicket(ticket, viewer);
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
      const viewer = await currentUser(request, authRepository);

      if (!ticket || !canAccessTicket(ticket, viewer)) {
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
      const viewer = await currentUser(request, authRepository);

      if (!ticket || !canAccessTicket(ticket, viewer)) {
        return reply.status(404).send(ticketNotFound);
      }

      const created = await ticketRepository.createReply(ticket.id, request.body.body.trim());

      return reply.status(201).send(toReply(created));
    }
  );

  app.patch<{
    Params: TicketAssignmentParams;
    Body: AssignTechnicianInput;
    Reply: Ticket | ApiError;
  }>(
    "/api/tickets/:ticketId/assignment",
    {
      schema: {
        params: ticketAssignmentParamsSchema,
        body: assignTechnicianBodySchema,
        response: {
          200: ticketResponseSchema,
          400: apiErrorResponseSchema,
          401: apiErrorResponseSchema,
          403: apiErrorResponseSchema,
          404: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const access = await requireTechnician(authRepository, request);
      if (access.type === "denied") {
        return reply.status(access.statusCode).send(access.body);
      }

      const result = await ticketRepository.assignTechnician(
        request.params.ticketId,
        request.body.assignedTechnicianId
      );

      if (result.type === "ticket-not-found") {
        return reply.status(404).send({
          error: { code: "TICKET_NOT_FOUND", message: "The ticket was not found" }
        });
      }
      if (result.type === "invalid-technician") {
        return reply.status(400).send({
          error: { code: "INVALID_TECHNICIAN", message: "The selected technician is invalid" }
        });
      }

      return reply.status(200).send(toTicket(result.ticket, access.user));
    }
  );
};
