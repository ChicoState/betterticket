import type { FastifyPluginAsync } from "fastify";

import { requireActor } from "../auth/auth-route.js";
import type { AuthRepository } from "../auth/auth-repository.js";
import type { CommentRepository } from "./comment-repository.js";
import type { TicketRepository } from "./ticket-repository.js";
import type { NotificationRepository } from "../notifications/notification-repository.js";

interface CommentRoutesOptions {
  authRepository: AuthRepository;
  commentRepository: CommentRepository;
  ticketRepository: TicketRepository;
  notificationRepository: NotificationRepository;
}

function commentResponse(
  comment: Awaited<ReturnType<CommentRepository["findById"]>>,
  helpfulCount = 0
) {
  if (!comment) return null;
  return {
    ...comment,
    helpfulCount,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    deletedAt: comment.deletedAt?.toISOString() ?? null
  };
}

export const commentRoutes: FastifyPluginAsync<CommentRoutesOptions> = async (app, options) => {
  const { authRepository, commentRepository, ticketRepository, notificationRepository } = options;

  app.post<{ Params: { ticketId: string }; Body: { body: string; parentCommentId?: string } }>(
    "/api/tickets/:ticketId/comments",
    async (request, reply) => {
      const actor = await requireActor(request, reply, authRepository, true);
      if (!actor) return;
      const body = request.body.body?.trim();
      if (!body || body.length > 5_000)
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Comment text must be between 1 and 5000 characters"
          }
        });
      if (!(await ticketRepository.findById(request.params.ticketId)))
        return reply
          .status(404)
          .send({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
      const parentCommentId = request.body.parentCommentId;
      if (parentCommentId) {
        const parent = await commentRepository.findById(parentCommentId);
        if (!parent || parent.ticketId !== request.params.ticketId || parent.parentCommentId)
          return reply.status(400).send({
            error: {
              code: "VALIDATION_ERROR",
              message: "Replies must target a top-level comment in this ticket"
            }
          });
      }
      const comment = await commentRepository.create({
        ticketId: request.params.ticketId,
        authorId: actor.id,
        body,
        parentCommentId
      });
      await notificationRepository.notifyParticipants({
        ticketId: comment.ticketId,
        commentId: comment.id,
        event: parentCommentId ? "REPLY" : "COMMENT",
        actorId: actor.id
      });
      return reply.status(201).send(commentResponse(comment, 0));
    }
  );

  app.patch<{ Params: { commentId: string }; Body: { body: string } }>(
    "/api/comments/:commentId",
    async (request, reply) => {
      const actor = await requireActor(request, reply, authRepository, true);
      if (!actor) return;
      const comment = await commentRepository.findById(request.params.commentId);
      if (!comment)
        return reply
          .status(404)
          .send({ error: { code: "NOT_FOUND", message: "Comment not found" } });
      if (comment.authorId !== actor.id || comment.deletedAt)
        return reply
          .status(403)
          .send({ error: { code: "FORBIDDEN", message: "Only the author may edit this comment" } });
      const body = request.body.body?.trim();
      if (!body || body.length > 5_000)
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Comment text must be between 1 and 5000 characters"
          }
        });
      return reply.send(
        commentResponse(
          await commentRepository.update(comment.id, body),
          await commentRepository.helpfulCount(comment.id)
        )
      );
    }
  );

  app.delete<{ Params: { commentId: string } }>(
    "/api/comments/:commentId",
    async (request, reply) => {
      const actor = await requireActor(request, reply, authRepository, true);
      if (!actor) return;
      const comment = await commentRepository.findById(request.params.commentId);
      if (!comment)
        return reply
          .status(404)
          .send({ error: { code: "NOT_FOUND", message: "Comment not found" } });
      const ticket = await ticketRepository.findById(comment.ticketId);
      if (ticket?.solutionCommentId === comment.id)
        return reply.status(409).send({
          error: { code: "CONFLICT", message: "Revoke the approved solution before deleting it" }
        });
      if (comment.authorId !== actor.id && actor.role !== "IT_MEMBER" && actor.role !== "ADMIN")
        return reply
          .status(403)
          .send({ error: { code: "FORBIDDEN", message: "You may not delete this comment" } });
      await commentRepository.softDelete(comment.id);
      return reply.status(204).send();
    }
  );

  app.put<{ Params: { commentId: string } }>(
    "/api/comments/:commentId/helpful",
    async (request, reply) => {
      const actor = await requireActor(request, reply, authRepository, true);
      if (!actor) return;
      const comment = await commentRepository.findById(request.params.commentId);
      if (!comment || comment.deletedAt)
        return reply
          .status(404)
          .send({ error: { code: "NOT_FOUND", message: "Comment not found" } });
      const isHelpful = await commentRepository.toggleHelpful(comment.id, actor.id);
      if (isHelpful)
        await notificationRepository.notifyParticipants({
          ticketId: comment.ticketId,
          commentId: comment.id,
          event: "HELPFUL",
          actorId: actor.id
        });
      return reply.send({
        isHelpful,
        helpfulCount: await commentRepository.helpfulCount(comment.id)
      });
    }
  );

  app.put<{ Params: { commentId: string }; Body: { isSpotlighted: boolean } }>(
    "/api/comments/:commentId/spotlight",
    async (request, reply) => {
      const actor = await requireActor(request, reply, authRepository, true);
      if (!actor) return;
      if (actor.role !== "IT_MEMBER" && actor.role !== "ADMIN")
        return reply
          .status(403)
          .send({ error: { code: "FORBIDDEN", message: "IT access is required" } });
      const comment = await commentRepository.findById(request.params.commentId);
      if (!comment || comment.deletedAt || typeof request.body.isSpotlighted !== "boolean")
        return reply
          .status(400)
          .send({ error: { code: "VALIDATION_ERROR", message: "Spotlight request is invalid" } });
      return reply.send(
        commentResponse(
          await commentRepository.setSpotlight(comment.id, request.body.isSpotlighted),
          await commentRepository.helpfulCount(comment.id)
        )
      );
    }
  );

  app.put<{ Params: { ticketId: string; commentId: string } }>(
    "/api/tickets/:ticketId/solution/:commentId",
    async (request, reply) => {
      const actor = await requireActor(request, reply, authRepository, true);
      if (!actor) return;
      if (actor.role !== "IT_MEMBER" && actor.role !== "ADMIN")
        return reply
          .status(403)
          .send({ error: { code: "FORBIDDEN", message: "IT access is required" } });
      const comment = await commentRepository.findById(request.params.commentId);
      if (!comment || comment.ticketId !== request.params.ticketId || comment.deletedAt)
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Solution must be a visible comment on this ticket"
          }
        });
      const ticket = await ticketRepository.setSolution(request.params.ticketId, comment.id);
      await notificationRepository.notifyParticipants({
        ticketId: request.params.ticketId,
        commentId: comment.id,
        event: "SOLUTION",
        actorId: actor.id
      });
      return ticket
        ? reply.send({
            ...ticket,
            createdAt: ticket.createdAt.toISOString(),
            updatedAt: ticket.updatedAt.toISOString()
          })
        : reply.status(404).send({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    }
  );
};
