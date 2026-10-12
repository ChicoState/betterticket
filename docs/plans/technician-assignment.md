# Implementation Plan: Technician Ticket Assignment

## Overview

Add the minimum user, password, server-session, and role authorization required for issue #13,
then add a nullable technician assignment to tickets and a small interactive provisioning command.

## Architecture Decisions

- Keep credentials on `users`; no separate identity or credential model is introduced.
- Store opaque sessions in PostgreSQL and send their raw tokens in an HttpOnly cookie.
- Keep the existing route-to-repository structure; no service layer or general auth framework is
  introduced.
- Keep ticket status independent from assignment.

## Task List

### Phase 1: Contract and Persistence

- [x] Add user/session/assignment schemas and a generated migration.
  - Acceptance: existing tickets remain valid with a null assignee; usernames are unique; foreign
    keys enforce user/session/assignment integrity.
  - Verify: inspect the generated migration and run database integration tests.
- [x] Add user provisioning to the PostgreSQL authentication repository and CLI.
  - Acceptance: `pnpm user:create` hashes the password and creates either supported role without
    logging the password.
  - Verify: provision a test user and authenticate with the entered password.

### Phase 2: Authentication

- [x] Add login/logout routes backed by expiring PostgreSQL sessions.
  - Acceptance: login sets the protected cookie; invalid credentials return a generic `401`;
    logout revokes and clears the session.
  - Verify: route and database integration tests.

### Phase 3: Assignment

- [x] Add the technician-protected assignment endpoint and persistence operation.
  - Acceptance: technicians can assign, reassign, and unassign; regular users cannot; targets must
    be technicians; ticket status is unchanged.
  - Verify: route and database integration tests.

### Checkpoint: Complete

- [ ] Formatting, linting, type checking, migrations, tests, coverage, build, and smoke checks pass.
- [x] README and AGENTS.md describe the new behavior and provisioning command.

## Risks and Mitigations

| Risk                                 | Impact | Mitigation                                                           |
| ------------------------------------ | ------ | -------------------------------------------------------------------- |
| Client forges a role or user id      | High   | Resolve caller and role exclusively from the server session.         |
| Database disclosure exposes sessions | High   | Store only SHA-256 session-token hashes.                             |
| Password guessing                    | High   | Use Argon2id, generic login failures, and route-level rate limiting. |
| Assignment targets a regular user    | Medium | Check the target's stored role before updating the ticket.           |
