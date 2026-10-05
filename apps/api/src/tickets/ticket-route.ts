import type { FastifyPluginAsync } from "fastify";

import { requireActor } from "../auth/auth-route.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import {
  apiErrorResponseSchema,
  createTicketBodySchema,
  normalizeCreateTicketInput,
  ticketResponseSchema,
  type CreateTicketInput,
  type Ticket
} from "./ticket-contract.js";
import type { TicketRepository } from "./ticket-repository.js";
import type { CommentRepository } from "./comment-repository.js";

interface TicketRoutesOptions {
  ticketRepository: TicketRepository;
  commentRepository: CommentRepository;
  authRepository: AuthRepository;
}

export const ticketRoutes: FastifyPluginAsync<TicketRoutesOptions> = async (
  app,
  { ticketRepository, commentRepository, authRepository }
) => {
  app.get("/api/tickets", async (request, reply) => {
    const actor = await requireActor(request, reply, authRepository);
    if (!actor) return;
    const tickets = await ticketRepository.list();
    return tickets.map((ticket) => ({
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString()
    }));
  });

  app.get<{ Params: { ticketId: string } }>("/api/tickets/:ticketId", async (request, reply) => {
    const actor = await requireActor(request, reply, authRepository);
    if (!actor) return;
    const ticket = await ticketRepository.findById(request.params.ticketId);
    if (!ticket)
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    const comments = await Promise.all(
      (await commentRepository.list(ticket.id)).map(async (comment) => ({
        ...comment,
        helpfulCount: await commentRepository.helpfulCount(comment.id),
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        deletedAt: comment.deletedAt?.toISOString() ?? null
      }))
    );
    return {
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      comments
    };
  });

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
      const actor = await requireActor(request, reply, authRepository, true);
      if (!actor) return;
      const ticket = await ticketRepository.create(
        normalizeCreateTicketInput(request.body),
        actor.id
      );

      return reply.status(201).send({
        ...ticket,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString()
      });
    }
  );
};
