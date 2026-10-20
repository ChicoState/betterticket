# Implementation Plan: IT Accounts (Issue #55)

## Overview

Allow an operator to designate an existing account as an IT account (role `TECHNICIAN`), centralize
the server-side IT authorization check so later abilities can reuse it, and show the IT designation
in the account menu. See `docs/specs/it-accounts.md`.

## Architecture Decisions

- Reuse the existing `TECHNICIAN` role; no schema change or migration is needed.
- Role changes go through an interactive CLI that mirrors `user:create`; there is no HTTP endpoint.
- Keep the route-to-repository structure; the guard is a small helper, not an auth framework.
- Record the role-management scope as ADR-006, which extends ADR-003's provisioning-only stance.

## Task List

### Task 1: Record the decision

- [x] Add `docs/decisions/006-it-account-designation.md` (CLI role designation, `TECHNICIAN` kept
      as the stored value, "IT" as the product term).
  - Acceptance: the ADR references ADR-003/004 and lists the in-app role manager as deferred.
  - Files: `docs/decisions/006-it-account-designation.md`. Scope: XS.

### Task 2: Persist role changes

- [x] Add `setUserRole(username, role)` to `AuthRepository` and `PostgresAuthRepository`. It returns
      the updated safe user, or `null` when the username is unknown.
  - Acceptance: username is normalized; only `role` changes; the password hash is never returned.
  - Verify: `postgres-auth-repository.integration.test.ts` covers promote, demote, and unknown user.
  - Files: `auth-repository.ts`, `postgres-auth-repository.ts`, its integration test, and any
    in-memory route-test fakes. Scope: S.

### Task 3: Add the `user:set-role` CLI

- [x] Add `apps/api/src/auth/set-user-role.ts` and the `user:set-role` script. Reuse role parsing
      from `create-user.ts` by extracting a shared `parseUserRole` helper.
  - Acceptance: interactive prompts only (no secrets or arguments needed), validated input,
    non-zero exit for an unknown user or invalid role.
  - Verify: unit test for `parseUserRole`; manually promote and then demote a local user.
  - Files: `set-user-role.ts`, `create-user.ts`, `auth-contract.ts`, `apps/api/package.json`,
    root `package.json` (if it proxies scripts). Scope: S.

### Checkpoint A

- [x] Typecheck, test, and the DB integration tests pass. A demoted user can still log in as `USER`.

### Task 4: Shared IT authorization guard

- [x] Extract session resolution and the role check into `requireTechnician(authRepository, request)` in

      `apps/api/src/auth/`. Replace the inline check in technician-only ticket routes.
  - Acceptance: assignment and status responses are unchanged. A role change applies on the next
    request.
  - Verify: route tests cover the assignment and status routes through the shared guard, plus a
    demoted-session test.

  - Files: new guard module, `ticket-route.ts`, `ticket-route.test.ts`. Scope: S.

### Task 5: Show IT designation in the account menu

- [x] Render an "IT" badge and the `(IT)` suffix on the accessible label for `TECHNICIAN` sessions.
  - Acceptance: no change for `USER` or anonymous; badge meets contrast and is not color-only.
  - Verify: `AccountMenu.test.tsx` cases for each session type. Browser check at mobile and
    desktop widths.
  - Files: `AccountMenu.tsx`, `AccountMenu.test.tsx`, `styles.css`. Scope: S.

### Task 6: Documentation


- [x] Document `pnpm user:set-role` in README and AGENTS.md (local verification/provisioning) and
      point the technician-assignment spec at the new command.

  - Files: `README.md`, `AGENTS.md`, `docs/specs/technician-assignment.md`. Scope: XS.

### Checkpoint B

- [x] Run the full pinned gate list from AGENTS.md, `bash scripts/smoke.sh`, and `git diff --check`.
- [x] Verify the IT badge in a real browser at mobile and desktop widths.

## Risks and Open Questions

- **Naming:** If the team prefers the stored value to read `IT`, that becomes a separate enum rename
  migration plus an API/web contract change. It is out of scope here.
- **Who designates IT users:** Operators with database access are the only option for now. An admin
  role is the natural next step when IT abilities grow.
- **Last IT account:** Demoting every technician leaves nobody able to assign tickets. That is
  acceptable for the MVP because the CLI can re-promote a user.
