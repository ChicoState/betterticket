# Implementation Plan: Baseline Ticket Replies

## Architecture Decisions

- Store replies in a `ticket_replies` table with a cascading foreign key to `tickets` and an index on `(ticket_id, created_at)` for the per-ticket listing.
- Extend `TicketRepository` with `createReply(ticketId, body)` and `listRecentReplies(ticketId, limit)` so route tests stay fast and a real-database test proves ordering.
- Look the ticket up in the route before reading or writing replies so a missing ticket is a `404` rather than an empty list or a foreign-key failure. Tickets cannot be deleted, so the check cannot race.
- Return the most recent replies in chronological order, so a new reply is always visible even on a ticket that has passed the limit.
- Nest replies under `/api/tickets/:id/replies` and wrap the list in a `{ replies }` object so paging metadata can be added without breaking clients.
- Keep replies in their own `TicketReplies` component with its own load state, so a failed reply load does not hide the ticket.

## Task List

### Phase 1: API

- [x] Add the `ticket_replies` table and migration.
  - Acceptance: the migration applies to a database that already has tickets.
  - Verify: `pnpm db:migrate`.
- [x] Add the reply schemas, repository methods, and the list and create routes.
  - Acceptance: replies list oldest first and capped at 200; valid replies return `201`; invalid bodies and IDs return `400` and unknown tickets `404` without a write.
  - Verify: API route tests and PostgreSQL integration tests.

### Phase 2: UI

- [x] Add the reply API client functions and the `TicketReplies` component.
  - Acceptance: loading, populated, empty, error-with-retry, posting, and failed-post states are accessible.
  - Verify: component tests.
- [x] Render the conversation and form on the ticket page.
  - Acceptance: a loaded ticket shows its replies and the form; a missing ticket shows neither.
  - Verify: `TicketDetail` and `App` tests.

### Checkpoint: complete

- [ ] Run format, lint, typecheck, tests, coverage, build, migration, browser verification, smoke test, and `git diff --check`.

## Risks and Mitigations

| Risk                                  | Impact | Mitigation                                                                             |
| ------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Spam or abuse on any ticket           | High   | ADR-004 requires rate limiting and a moderation path before public deployment.         |
| Replies mistaken for official answers | Medium | The form states replies are anonymous; verified roles wait for a reply-authorship ADR. |
| Unbounded conversation responses      | Medium | Cap the query and response schema at the 200 most recent replies.                      |
| Replies are public                    | Medium | State it beside the form; the footer already warns against sensitive information.      |
| UI/API drift                          | Medium | Validate the response shape in the client and test the contract at both boundaries.    |
