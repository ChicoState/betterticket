# Implementation Plan: Baseline Ticket Creation

## Architecture Decisions

- Keep create input separate from the persisted/output ticket type, allowing additive fields without accepting server-managed values.
- Put PostgreSQL access behind a small `TicketRepository` interface so route behavior is fast to test while a real-database integration test proves persistence.
- Proxy `/api` through Vite in development, avoiding a permissive CORS policy.
- Anonymous creation is an explicitly temporary capability; no synthetic user or nullable owner column is introduced before the account model is designed.

## Task List

### Phase 1: Contract and persistence

- [ ] Define ticket types, validation schema, Drizzle table, and initial migration.
  - Acceptance: input fields and server-managed fields are distinct; the migration creates only ticket data required by issue #30.
  - Verify: schema/type checks and generated migration review.
- [ ] Implement the PostgreSQL repository using parameterized Drizzle inserts.
  - Acceptance: inserted rows are returned with their generated values.
  - Verify: PostgreSQL integration test.

### Checkpoint: persistence

- [ ] Migration applies to a clean local database and integration tests pass.

### Phase 2: API and UI

- [ ] Add the Fastify ticket creation route and tests.
  - Acceptance: valid input returns `201`; invalid and unknown fields return stable `400` errors without writes.
  - Verify: API route tests.
- [ ] Add the React form and component tests.
  - Acceptance: labeled fields submit to the API and accessible status regions report pending, success, and failure states.
  - Verify: component tests and production build.

### Checkpoint: complete

- [ ] Run format, lint, typecheck, tests, coverage, build, migration, browser verification, smoke test, and `git diff --check`.

## Risks and Mitigations

| Risk                    | Impact | Mitigation                                                                                        |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Anonymous spam          | Medium | Keep this slice limited to creation; document rate limiting as required before public deployment. |
| Schema churn            | Medium | Separate input/output types and keep ticket schema/routes in focused modules.                     |
| Database errors leaking | High   | Map unexpected failures to a generic error response and retain server-side logging.               |
| UI/API drift            | Medium | Test the documented request and response contract at both boundaries.                             |

## Open Questions

None for issue #30.
