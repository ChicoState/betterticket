# Implementation Plan: Technician Ticket Status Updates

## Overview

Extend the existing read-only five-stage ticket progress feature with a technician-protected status
mutation workflow. Reuse the current ticket response, server-side sessions, `TECHNICIAN` role,
PostgreSQL status enum, `updatedAt`, and public progress timeline.

## Architecture Decisions

- Reuse the existing public ticket response rather than introduce a new progress endpoint.
- Model the approved lifecycle as a PostgreSQL enum and matching API/client finite sets.
- Render a five-stage timeline from a single ordered frontend list; no event history is stored or displayed.
- Authorize status changes from the existing server-side session and `TECHNICIAN` role; do not trust
  client identity or restrict changes to the assigned technician.
- Enforce adjacent forward transitions in the repository. Same-status updates are idempotent and do
  not update `updatedAt`; valid changes do update it.
- Keep notifications and status history/audit records out of this sprint. No migration is expected.

## Task List

### Phase 1: Contract and persistence

- [x] Extend the `ticket_status` enum with `UNDER_REVIEW`, `IN_PROGRESS`, `RESOLVED`, and `COMPLETED` while retaining `OPEN` as the default.
  - Acceptance: the database and ticket contract accept exactly the five approved values.
  - Verify: API route and PostgreSQL integration tests.

- [x] Add the status-update request contract and repository result types.
  - Acceptance: the request accepts exactly one approved `status`; repository results distinguish
    updated, unchanged, missing-ticket, and invalid-transition outcomes.
  - Verify: contract/route validation tests reject unknown and unsupported fields.
  - Files: `apps/api/src/tickets/ticket-contract.ts`, `apps/api/src/tickets/ticket-repository.ts`

- [x] Implement repository status updates using the existing `status` and `updatedAt` fields.
  - Acceptance: adjacent forward transitions succeed, same-status requests are unchanged, skipped
    and backward transitions fail, and `COMPLETED` is terminal.
  - Verify: PostgreSQL integration tests cover the complete transition matrix and timestamp behavior.
  - Files: `apps/api/src/database/postgres-ticket-repository.ts`

### Checkpoint: API foundation

- [x] Repository transition tests pass without changing the schema or migrations.
- [x] The status contract still contains exactly the five approved statuses.

### Phase 2: Public tracking UI

- [x] Validate the complete ticket response in the frontend and render the status, lifecycle timeline, and last-updated time on ticket detail pages.
  - Acceptance: each state identifies completed, current, and upcoming stages in text and visual styling.
  - Verify: TicketDetail component tests and production build.

- [x] Add the technician-protected status endpoint.
  - Acceptance: valid sessions with role `TECHNICIAN` can update any ticket; anonymous requests
    return `401`; authenticated `USER` requests return `403`; missing tickets return `404`; invalid
    transitions return a stable `400` error; successful responses use the existing ticket contract.
  - Verify: API route tests cover authorization, validation, success, idempotency, and errors.
  - Files: `apps/api/src/tickets/ticket-route.ts`, `apps/api/src/tickets/ticket-route.test.ts`

- [x] Add technician controls to ticket detail.
  - Acceptance: only technicians see controls for valid next stages; controls are disabled while a
    request is pending; successful updates replace the ticket state and timeline; errors are
    accessible and retryable.
  - Verify: React component and application tests cover anonymous, regular-user, technician,
    success, loading, authorization-error, and invalid-transition states.
  - Files: `apps/web/src/App.tsx`, `apps/web/src/tickets/ticket-api.ts`,
    `apps/web/src/tickets/TicketDetail.tsx`, relevant tests/styles

### Checkpoint: End-to-end status update

- [x] A technician can advance a ticket one stage at a time from the detail page.
- [x] Public viewers still see the updated status and five-stage timeline.
- [x] No notification or status-history behavior is introduced.

### Phase 3: Documentation

- [x] Record the status-update authorization, transition, idempotency, and scope decisions.
  - Acceptance: the specification and ADR define the endpoint, role, transition matrix, timestamp
    behavior, and explicit exclusions.

- [x] Update API/UI documentation if the implementation changes any documented command or route
      behavior.
  - Acceptance: README and agent guidance remain accurate without documenting implementation details
    that are not yet approved.

### Checkpoint: complete

- [x] Run format, lint, typecheck, tests, build, and `git diff --check`.
- [ ] Run coverage and the smoke test.
- [x] Do not run or add a migration unless implementation reveals a genuine schema requirement.

## Risks and Mitigations

| Risk                                    | Impact | Mitigation                                                           |
| --------------------------------------- | ------ | -------------------------------------------------------------------- |
| Client forges technician identity       | High   | Resolve role only from the existing server-side session.             |
| Status lifecycle becomes inconsistent   | High   | Enforce adjacent transitions in the repository and test matrix.      |
| Stale clients overwrite newer status    | Medium | Re-read/update atomically and return the current ticket response.    |
| Controls are inaccessible or misleading | Medium | Use labels, keyboard support, disabled states, and announced errors. |
| Notification work changes feature scope | Medium | Keep notification and history work explicitly out of this sprint.    |
