# Spec: Technician Ticket Assignment

## Objective

Deliver issue #13 as a minimal authenticated backend workflow. A provisioned user can log in,
and a user whose database role is `TECHNICIAN` can assign, reassign, or unassign one technician
from a ticket without changing the ticket's status.

## Contract

- `POST /api/sessions` accepts `username` and `password`, creates a server-side session, sets an
  HttpOnly cookie, and returns the authenticated user's id, name, username, and role.
- `DELETE /api/sessions/current` revokes the presented session and clears its cookie.
- `PATCH /api/tickets/:ticketId/assignment` accepts `assignedTechnicianId`, which is either a user
  UUID or `null`, and returns the updated ticket.
- The assignment endpoint returns `401` without a valid session, `403` when the authenticated user
  is not a technician, `404` when the ticket does not exist, and `400` when a non-technician or
  nonexistent user is selected.
- `POST /api/tickets` remains anonymous and otherwise unchanged.

## Authentication and Authorization

- A user has `id`, `name`, unique normalized `username`, Argon2id `passwordHash`, and role `USER`
  or `TECHNICIAN`.
- PostgreSQL stores a SHA-256 hash of each random session token, its user id, and its expiration.
- The raw session token is sent only in an HttpOnly, SameSite=Strict cookie that is Secure in
  production.
- Every assignment request resolves the session and role from PostgreSQL; client-supplied identity
  or role data is never trusted.
- The target user is independently verified as a technician before assignment.

## Provisioning

`pnpm user:create` interactively requests name, username, password, and role. It uses the same
Argon2id hashing implementation as login and is the only account-creation mechanism in this MVP.

## Tech Stack and Structure

- Fastify owns validation, cookies, login rate limiting, and HTTP responses.
- Drizzle owns the PostgreSQL users, sessions, and ticket assignment schema.
- Authentication and ticket routes depend on small repository interfaces so route tests can use
  in-memory fakes while database integration tests cover persistence and hashing.

## Commands

```sh
docker compose --profile tools run --rm toolchain pnpm install --frozen-lockfile
docker compose --profile tools run --rm toolchain pnpm db:migrate
docker compose --profile tools run --rm toolchain pnpm user:create
docker compose --profile tools run --rm toolchain pnpm test
docker compose --profile tools run --rm toolchain pnpm coverage
```

## Testing Strategy

- Route tests cover login, logout, cookie behavior, authentication, authorization, validation, and
  assignment outcomes.
- PostgreSQL integration tests prove password verification, session lookup/revocation, user
  provisioning, foreign keys, and assignment persistence.
- Existing anonymous ticket-creation tests remain regression coverage.

## Boundaries

- Always: validate HTTP and CLI input, hash passwords, store only session-token hashes, use
  parameterized Drizzle queries, and update `updatedAt` when assignment changes.
- Ask first: add public registration, password reset, role management, ticket ownership, or
  authenticated user ticket-reading behavior.
- Never: accept a role or caller id as proof of authorization, expose password hashes, log
  passwords/session tokens, or commit provisioned credentials.

## Success Criteria

- A provisioned user can log in and log out with a server-side session.
- Only authenticated technicians can assign, reassign, or unassign tickets.
- Only users whose stored role is `TECHNICIAN` can be assigned.
- Assignment changes neither ticket status nor anonymous ticket creation.
- Required tests and repository quality gates pass.

## Excluded from MVP

Registration, password reset, account management, admin roles, multiple assignees, notifications,
advanced ticket workflow, frontend technician screens, and user-visible ticket reading are out of
scope.
