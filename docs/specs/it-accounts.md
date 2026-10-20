# Spec: IT Accounts (Issue #55)

## Status

Approved — implemented.

## Objective

An IT technician needs an account that is distinct from a regular user account so that later
features can grant it special abilities. This issue only establishes the designation and a single
reusable authorization check; it adds no new IT abilities.

## Current State

ADR-003 already models IT staff as users whose stored role is `TECHNICIAN`, and ADR-004 limits
self-registration to `USER`. The gaps are:

- An existing account cannot be designated (or undesignated) as IT; the only path is creating a
  brand-new account with `pnpm user:create`.
- The only role check is an inline `user.role !== "TECHNICIAN"` in the assignment route, so each
  future IT ability would duplicate session and role handling.
- The browser shows no indication that the signed-in account is an IT account.

## Decisions

- **Keep `TECHNICIAN` as the stored role value.** "IT account" is the product term and UI label.
  Renaming the enum would require a migration and an API contract change for no behavioral gain.
- **Designate through an operator CLI only.** There is no administrator role, so an in-app role
  manager would need its own authorization design. That remains future work.
- **Authorization stays server-side.** Each request resolves the role from PostgreSQL through the
  session, so a role change takes effect on the next request without revoking sessions.

## Contract

- `pnpm user:set-role` interactively prompts for a username and a role (`USER` or `TECHNICIAN`),
  updates that user, and prints `Updated <username> to <ROLE>.` It exits non-zero for an unknown
  user or invalid role.
- A shared `requireTechnician` guard in `apps/api/src/auth/` returns either the authenticated
  technician or the `401 AUTHENTICATION_REQUIRED` / `403 FORBIDDEN` response for the route to send.
  Technician-only ticket routes use it with unchanged responses.
- The account menu shows an "IT" badge for signed-in `TECHNICIAN` users. Its accessible label
  becomes `Account: Signed in as <name> (IT)`. Regular users and anonymous visitors see no change.
- Public API contracts are unchanged. `POST /api/users` still creates only `USER`.

## Boundaries

- Always: validate CLI input, keep role decisions on the server, and keep `role` out of public
  registration.
- Never: accept a client-supplied role, expose password hashes, or put credentials in tracked files
  or command arguments.
- Excluded: new IT-only abilities, an admin role or role-management UI, audit logging of role
  changes, and an IT-only frontend.

## Verification

- Repository integration test: a role update persists, and the update reports when no user matches.
- Route tests: assignment and status `401`/`403` tests pass through the shared guard. Unauthenticated
  requests receive `401`, unauthorized users receive `403`, and a user demoted mid-session receives
  `403` on the next request. Existing assignment and status API responses remain unchanged.
- Component test: the IT badge and accessible label appear only for `TECHNICIAN`.
- Pinned format, lint, typecheck, migrate, test, coverage, build, and smoke gates pass.
