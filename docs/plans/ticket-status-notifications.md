# Implementation Plan: Ticket Status Notifications

## Overview

Implement `docs/specs/ticket-status-notifications.md` and ADR-008. Add a technician-only status
update API, persist a notification for the ticket owner in the same transaction, and show the
owner's notifications in a polled header pane.

## Architecture Decisions

- Keep the route-to-repository structure. The ticket repository writes the status change and the
  notification in one Drizzle transaction, so no service layer or event bus is needed.
- Notifications get their own contract, route plugin, and repository interface, matching the
  layout of `auth` and `tickets`.
- The transition rule is a pure contract function shared by the route and its tests.
- The web pane mirrors `AccountMenu` interaction patterns and polls with `setInterval` plus a
  window `focus` listener.

## Task List

### Phase 1: Persistence

- [x] Add the `notifications` table and generate its migration.
  - Acceptance: the migration is additive, foreign keys cascade, and the `(user_id, created_at)`
    index exists.
  - Verify: inspect the generated SQL and run `pnpm db:migrate`.

### Phase 2: Status Update API

- [x] Add the transition rule, the `PATCH /api/tickets/:ticketId/status` route, and
      `updateStatus` on the ticket repository.
  - Acceptance: technician-only; one adjacent stage up to `RESOLVED`; `401`/`403`/`404`/`400` as
    specified; `updatedAt` changes; the owner is notified atomically, but not unsigned tickets and
    not when the owner is the actor.
  - Verify: route tests and PostgreSQL integration tests.

### Phase 3: Notifications API

- [x] Add `GET /api/notifications` and `POST /api/notifications/read`.
  - Acceptance: session required; only the caller's 20 newest notifications plus the unread count;
    mark-read affects only the caller.
  - Verify: route tests and PostgreSQL integration tests for isolation between users.

### Phase 4: Header Pane

- [x] Add `notification-api.ts` and `NotificationPane`, mounted in the header for authenticated
      users.
  - Acceptance: unread badge, list with ticket links, empty and error states, mark-read on open,
    30-second and focus polling, Escape and outside-click close.
  - Verify: component tests with fake timers and the App test.

### Checkpoint: Complete

- [x] Formatting, linting, type checking, migrations, tests, coverage, build, and smoke checks pass.
- [x] README and AGENTS.md describe the new behavior.

## Risks and Mitigations

| Risk                                     | Impact | Mitigation                                                      |
| ---------------------------------------- | ------ | --------------------------------------------------------------- |
| User reads another user's notifications  | High   | Every query is scoped by the session user id, never by input.   |
| Anonymous poster's identity leaks        | High   | Notification responses never include creator or actor identity. |
| Status changes without a notification    | Medium | Write both in one Drizzle transaction.                          |
| Concurrent updates skip the forward rule | Medium | Lock the ticket row (`FOR UPDATE`) before checking.             |
| Polling load                             | Low    | 30-second interval, 20-row limit, indexed query.                |
