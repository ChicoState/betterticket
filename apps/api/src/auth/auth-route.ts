import { createHash } from "node:crypto";

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import { createOpaqueToken, hashPassword, verifyPassword } from "./password.js";
import type { AuthRepository, AuthUser, Role } from "./auth-repository.js";

export interface Actor {
  id: string;
  email: string;
  role: Role;
  csrfToken: string;
}

export interface AuthRoutesOptions {
  authRepository: AuthRepository;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request: FastifyRequest, name: string): string | null {
  const pair = request.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

function publicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword
  };
}

export async function requireActor(
  request: FastifyRequest,
  reply: FastifyReply,
  authRepository: AuthRepository,
  requireCsrf = false
): Promise<Actor | null> {
  const token = readCookie(request, "bt_session");
  if (!token) {
    await reply
      .status(401)
      .send({ error: { code: "UNAUTHENTICATED", message: "Sign in is required" } });
    return null;
  }
  const session = await authRepository.findSession(tokenHash(token));
  if (!session || (requireCsrf && request.headers["x-csrf-token"] !== session.csrfToken)) {
    await reply.status(requireCsrf ? 403 : 401).send({
      error: {
        code: requireCsrf ? "FORBIDDEN" : "UNAUTHENTICATED",
        message: requireCsrf ? "Invalid CSRF token" : "Sign in is required"
      }
    });
    return null;
  }
  return { ...session.user, csrfToken: session.csrfToken };
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  { authRepository }
) => {
  app.post<{ Body: { email: string; password: string } }>(
    "/api/auth/login",
    async (request, reply) => {
      const email = request.body.email?.trim().toLowerCase();
      const password = request.body.password;
      if (!email || !password)
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "Email and password are required" }
        });
      const user = await authRepository.findUserByEmail(email);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return reply.status(401).send({
          error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" }
        });
      }
      const token = createOpaqueToken();
      const csrfToken = createOpaqueToken();
      await authRepository.createSession({
        userId: user.id,
        tokenHash: tokenHash(token),
        csrfToken,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
      });
      reply.header(
        "set-cookie",
        `bt_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=604800`
      );
      return reply.send({ user: publicUser(user), csrfToken });
    }
  );

  app.get("/api/auth/me", async (request, reply) => {
    const actor = await requireActor(request, reply, authRepository);
    return actor
      ? { user: { id: actor.id, email: actor.email, role: actor.role }, csrfToken: actor.csrfToken }
      : undefined;
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const actor = await requireActor(request, reply, authRepository, true);
    if (!actor) return;
    const token = readCookie(request, "bt_session");
    if (token) await authRepository.deleteSession(tokenHash(token));
    reply.header("set-cookie", "bt_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0");
    return reply.status(204).send();
  });

  app.post<{ Body: { currentPassword: string; newPassword: string } }>(
    "/api/auth/password",
    async (request, reply) => {
      const actor = await requireActor(request, reply, authRepository, true);
      if (!actor) return;
      const user = await authRepository.findUserByEmail(actor.email);
      const { currentPassword, newPassword } = request.body;
      if (
        !user ||
        !(await verifyPassword(currentPassword ?? "", user.passwordHash)) ||
        !newPassword ||
        newPassword.length < 12
      ) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Current password or new password is invalid"
          }
        });
      }
      await authRepository.changePassword(actor.id, await hashPassword(newPassword));
      return reply.status(204).send();
    }
  );

  app.post<{ Body: { email: string; temporaryPassword: string; role?: Role } }>(
    "/api/users",
    async (request, reply) => {
      const actor = await requireActor(request, reply, authRepository, true);
      if (!actor) return;
      if (actor.role !== "ADMIN")
        return reply
          .status(403)
          .send({ error: { code: "FORBIDDEN", message: "Administrator access is required" } });
      const email = request.body.email?.trim().toLowerCase();
      const temporaryPassword = request.body.temporaryPassword;
      const role = request.body.role ?? "USER";
      if (
        !email ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        !temporaryPassword ||
        temporaryPassword.length < 12 ||
        !["USER", "IT_MEMBER", "ADMIN"].includes(role)
      ) {
        return reply
          .status(400)
          .send({ error: { code: "VALIDATION_ERROR", message: "User details are invalid" } });
      }
      if (await authRepository.findUserByEmail(email))
        return reply.status(409).send({
          error: { code: "CONFLICT", message: "An account with that email already exists" }
        });
      const user = await authRepository.createUser({
        email,
        role,
        passwordHash: await hashPassword(temporaryPassword)
      });
      return reply.status(201).send({ user: publicUser(user) });
    }
  );
};
