import type { FastifyRequest } from "fastify";

import { sessionCookieName, type ApiError, type AuthenticatedUser } from "./auth-contract.js";
import type { AuthRepository } from "./auth-repository.js";

export type TechnicianAccess =
  | { type: "allowed"; user: AuthenticatedUser }
  | { type: "denied"; statusCode: 401 | 403; body: ApiError };

// Resolves the caller's role from the server-side session on every request so IT-only routes
// never trust client-supplied identity and see role changes immediately.
export async function requireTechnician(
  authRepository: AuthRepository,
  request: FastifyRequest
): Promise<TechnicianAccess> {
  const token = request.cookies[sessionCookieName];
  const user = token ? await authRepository.findUserBySession(token) : null;

  if (!user) {
    return {
      type: "denied",
      statusCode: 401,
      body: { error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required" } }
    };
  }
  if (user.role !== "TECHNICIAN") {
    return {
      type: "denied",
      statusCode: 403,
      body: { error: { code: "FORBIDDEN", message: "Technician access is required" } }
    };
  }

  return { type: "allowed", user };
}
