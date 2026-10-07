# Implementation Plan: Ticket Progress

## Architecture Decisions

- Reuse the existing public ticket response rather than introduce a new progress endpoint.
- Model the approved lifecycle as a PostgreSQL enum and matching API/client finite sets.
- Render a five-stage timeline from a single ordered frontend list; no event history is stored or displayed.
- Preserve the absence of ticket-status mutation until authentication and authorization are designed.

## Task List

### Phase 1: Contract and persistence

- [x] Extend the `ticket_status` enum with `UNDER_REVIEW`, `IN_PROGRESS`, `RESOLVED`, and `COMPLETED` while retaining `OPEN` as the default.
  - Acceptance: the database and ticket contract accept exactly the five approved values.
  - Verify: API route and PostgreSQL integration tests.

### Phase 2: Public tracking UI

- [x] Validate the complete ticket response in the frontend and render the status, lifecycle timeline, and last-updated time on ticket detail pages.
  - Acceptance: each state identifies completed, current, and upcoming stages in text and visual styling.
  - Verify: TicketDetail component tests and production build.

### Phase 3: Documentation

- [x] Record the public status lifecycle and the dependency on a future authorized staff workflow.
  - Acceptance: documentation rules out anonymous mutation, notifications, status history, and unapproved statuses.

### Checkpoint: complete

- [ ] Run format, lint, typecheck, migrations, tests, coverage, build, smoke test, and `git diff --check`.

## Risks and Mitigations

| Risk                                         | Impact | Mitigation                                                             |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| Public status mutation without authorization | High   | No mutation route, repository method, or UI is included.               |
| Status values drift between layers           | Medium | Keep finite contract/client lists and test persistence plus rendering. |
| Timeline relies only on color                | Medium | Show explicit Complete, Current stage, and Upcoming text.              |
