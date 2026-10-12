import type { FastifyPluginAsync } from "fastify";

import {
  authenticatedUserResponseSchema,
  loginBodySchema,
  normalizeUsername,
  registrationBodySchema,
  sessionCookieName,
  sessionMaxAgeSeconds,
  type ApiError,
  type AuthenticatedUser,
  type LoginInput,
  type RegisterUserInput
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
  app.get<{ Reply: AuthenticatedUser | ApiError }>(
    "/api/sessions/current",
    {
      schema: {
        response: {
          200: authenticatedUserResponseSchema,
          401: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const token = request.cookies[sessionCookieName];
      const user = token ? await authRepository.findUserBySession(token) : null;

      if (!user) {
        return reply
          .clearCookie(sessionCookieName, sessionCookieOptions())
          .status(401)
          .send({
            error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required" }
          });
      }

      return reply.status(200).send(user);
    }
  );

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

  app.post<{ Body: RegisterUserInput; Reply: AuthenticatedUser | ApiError }>(
    "/api/users",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: registrationBodySchema,
        response: {
          201: authenticatedUserResponseSchema,
          400: apiErrorResponseSchema,
          409: apiErrorResponseSchema,
          429: apiErrorResponseSchema,
          500: apiErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const user = await authRepository.createUser({ ...request.body, role: "USER" });

      if (!user) {
        return reply.status(409).send({
          error: { code: "USERNAME_UNAVAILABLE", message: "That username is unavailable" }
        });
      }

      return reply.status(201).send(user);
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
