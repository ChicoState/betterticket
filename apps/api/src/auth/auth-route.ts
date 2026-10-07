import type { FastifyPluginAsync } from "fastify";

import {
  authenticatedUserResponseSchema,
  loginBodySchema,
  normalizeUsername,
  sessionCookieName,
  sessionMaxAgeSeconds,
  type ApiError,
  type AuthenticatedUser,
  type LoginInput
} from "./auth-contract.js";
import type { AuthRepository } from "./auth-repository.js";
import { apiErrorResponseSchema } from "../tickets/ticket-contract.js";

interface AuthRoutesOptions {
  authRepository: AuthRepository;
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  { authRepository }
) => {
  app.post<{ Body: LoginInput; Reply: AuthenticatedUser | ApiError }>(
    "/api/sessions",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: loginBodySchema,
        response: {
          200: authenticatedUserResponseSchema,
          400: apiErrorResponseSchema,
          401: apiErrorResponseSchema,
          429: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const session = await authRepository.createSession({
        username: normalizeUsername(request.body.username),
        password: request.body.password
      });

      if (!session) {
        return reply.status(401).send({
          error: { code: "INVALID_CREDENTIALS", message: "Username or password is incorrect" }
        });
      }

      return reply
        .setCookie(sessionCookieName, session.token, sessionCookieOptions())
        .status(200)
        .send(session.user);
    }
  );

  app.delete("/api/sessions/current", async (request, reply) => {
    const token = request.cookies[sessionCookieName];
    if (token) {
      await authRepository.deleteSession(token);
    }

    return reply.clearCookie(sessionCookieName, sessionCookieOptions()).status(204).send();
  });
};
