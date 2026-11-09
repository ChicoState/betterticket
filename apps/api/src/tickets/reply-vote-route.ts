import { voteBodySchema, voteStateResponseSchema } from "./vote-contract.js";
import type { FastifyPluginAsync } from "fastify";
import { sessionCookieName } from "../auth/auth-contract.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import { apiErrorResponseSchema, type ApiError } from "./ticket-contract.js";
import type { VoteValue, VoteState, TicketRepository } from "./ticket-repository.js";
import { canAccessTicket } from "./ticket-access.js";

interface Options {
  authRepository: AuthRepository;
  ticketRepository: TicketRepository;
}
interface Params {
  ticketId: string;
  replyId: string;
}
const paramsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticketId", "replyId"],
  properties: {
    ticketId: { type: "string", format: "uuid" },
    replyId: { type: "string", format: "uuid" }
  }
} as const;
const responseSchema = {
  200: voteStateResponseSchema,
  400: apiErrorResponseSchema,
  401: apiErrorResponseSchema,
  404: apiErrorResponseSchema,
  500: apiErrorResponseSchema
} as const;

export const replyVoteRoutes: FastifyPluginAsync<Options> = async (
  app,
  { authRepository, ticketRepository }
) => {
  for (const method of ["PUT", "DELETE"] as const) {
    app.route<{ Params: Params; Body: { value: VoteValue }; Reply: VoteState | ApiError }>({
      method,
      url: "/api/tickets/:ticketId/replies/:replyId/vote",
      schema: {
        params: paramsSchema,
        ...(method === "PUT" ? { body: voteBodySchema } : {}),
        response: responseSchema
      },
      handler: async (request, reply) => {
        reply.header("cache-control", "private, no-store");
        const token = request.cookies[sessionCookieName];
        const user = token ? await authRepository.findUserBySession(token) : null;
        if (!user) {
          return reply.status(401).send({
            error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in to vote on replies" }
          });
        }
        const ticket = await ticketRepository.findById(request.params.ticketId);
        if (!ticket || !canAccessTicket(ticket, user)) {
          return reply
            .status(404)
            .send({ error: { code: "NOT_FOUND", message: "The ticket was not found" } });
        }
        const result = await ticketRepository.setReplyVote(
          request.params.ticketId,
          request.params.replyId,
          user.id,
          method === "PUT" ? request.body.value : null
        );
        if (result.type === "reply-not-found") {
          return reply
            .status(404)
            .send({ error: { code: "NOT_FOUND", message: "The reply was not found" } });
        }
        return reply.status(200).send(result.vote);
      }
    });
  }
};
