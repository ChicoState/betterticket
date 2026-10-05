# Implementation Plan: Baseline Ticket Viewer

## Architecture Decisions

- Extend `TicketRepository` with `listRecent(limit)` so route tests stay fast and a real-database test proves ordering.
- Wrap the list in a `{ tickets }` object so pagination metadata can be added without breaking clients.
- Choose the page from `window.location.pathname` with plain links instead of adding a router for two pages.
- No schema change or migration; the viewer reads the existing `tickets` table.

## Task List

### Phase 1: API

- [x] Add the list response schema, repository method, and `GET /api/tickets` route.
  - Acceptance: tickets return newest first, capped at 100, with the creation response shape.
  - Verify: API route tests and PostgreSQL integration test.

### Phase 2: UI

- [x] Add the `TicketList` component and API client function.
  - Acceptance: loading, populated, empty, and error-with-retry states are accessible.
  - Verify: component tests.
- [x] Make the list the homepage and move the form to `/new` with header navigation.
  - Acceptance: both pages are reachable from each other by keyboard.
  - Verify: `App` tests and production build.

### Checkpoint: complete

- [ ] Run format, lint, typecheck, tests, coverage, build, migration, browser verification, smoke test, and `git diff --check`.

## Risks and Mitigations

| Risk                         | Impact | Mitigation                                                                          |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------- |
| Submitted details are public | High   | State it in the UI; ADR-002 requires a visibility review before public deployment.  |
| Unbounded list responses     | Medium | Cap the query and response schema at 100 tickets.                                   |
| Deep links to `/new`         | Low    | The static host must serve `index.html` for unknown paths; Vite does this in dev.   |
| UI/API drift                 | Medium | Validate the response shape in the client and test the contract at both boundaries. |
