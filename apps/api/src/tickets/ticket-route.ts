import type { FastifyPluginAsync } from "fastify";

import { sessionCookieName, type ApiError } from "../auth/auth-contract.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import {
  apiErrorResponseSchema,
  assignTechnicianBodySchema,
  createTicketBodySchema,
  normalizeCreateTicketInput,
  ticketAssignmentParamsSchema,
  ticketResponseSchema,
  type AssignTechnicianInput,
  type CreateTicketInput,
  type Ticket,
  type TicketAssignmentParams
} from "./ticket-contract.js";
import type { TicketRecord, TicketRepository } from "./ticket-repository.js";

interface TicketRoutesOptions {
  authRepository: AuthRepository;
  ticketRepository: TicketRepository;
}

function toTicketResponse(ticket: TicketRecord): Ticket {
  return {
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString()
  };
}

export const ticketRoutes: FastifyPluginAsync<TicketRoutesOptions> = async (
  app,
  { authRepository, ticketRepository }
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

      return reply.status(201).send(toTicketResponse(ticket));
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
      const token = request.cookies[sessionCookieName];
      const user = token ? await authRepository.findUserBySession(token) : null;

      if (!user) {
        return reply.status(401).send({
          error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required" }
        });
      }
      if (user.role !== "TECHNICIAN") {
        return reply.status(403).send({
          error: { code: "FORBIDDEN", message: "Technician access is required" }
        });
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

      return reply.status(200).send(toTicketResponse(result.ticket));
    }
  );
};
