# Implementation Plan: Ticket History

## Architecture Decisions

- Add `GET /api/tickets/history` rather than changing the public ticket list contract.
- Query `tickets.creatorUserId` from the authenticated session user and cap results at the existing
  100-ticket list limit.
- Use `/history` for the frontend page so `/tickets/:id` remains the existing detail route.
- Reuse the ticket response shape and detail page; no database migration is required.

## Task List

### Phase 1: API

- [x] Add creator-scoped repository query, authenticated route, response contract, and route tests.

### Phase 2: UI

- [x] Add history API client, page, account-menu entry, and loading/empty/error states.
- [x] Link history rows to existing ticket details and add component coverage.

### Checkpoint: complete

- [ ] Run formatting, lint, typecheck, tests, coverage, build, migration, and smoke checks.
