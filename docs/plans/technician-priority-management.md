# Implementation Plan: Technician-Managed Ticket Priority

## Overview

Extend the existing ticket priority feature so authenticated technicians can
change the canonical priority after creation while preserving creator-selected
initial priority, visibility, all other ticket state, and database-backed
sorting.

## Architecture Decisions

- Add a focused priority subresource endpoint matching the existing status and
  assignment route conventions.
- Reuse the existing priority enum, ticket response schema, session repository,
  and `requireTechnician` authorization helper.
- Use a conditional PostgreSQL update so changed values refresh `updatedAt` and
  no-op updates preserve it.
- Keep the editing state local to the ticket detail page; do not add global
  state, a new dependency, or an optimistic update.

## Task List

### Phase 1: Backend Contract and Persistence

- [x] Add failing route tests for validation, authentication, technician
      authorization, successful transitions, repeat updates, not-found behavior,
      and response-field preservation.
- [x] Add failing PostgreSQL tests for persistence, `updatedAt`, idempotence,
      field preservation, completed tickets, and sorting after an update.
- [x] Add the request schema, repository result contract, conditional database
      update, and technician-protected route needed to pass those tests.

### Checkpoint: Backend

- [x] Focused API and PostgreSQL tests pass.
- [x] Type checking confirms the repository contract is implemented by all test
      doubles and the PostgreSQL repository.

### Phase 2: Technician UI

- [x] Add failing API-client and component tests for technician visibility,
      initial selection, unchanged selection, loading, success, and failure.
- [x] Add the validated API client and an accessible priority editor beside the
      existing priority information.
- [x] Confirm regular users and anonymous visitors retain the read-only badge.

### Checkpoint: UI

- [x] Focused web tests pass.
- [x] The production build and automated component tests preserve existing ticket
      status, reply, voting, and solution controls.
- [ ] Manually verify the workflow in a real browser when browser automation is
      available.

### Phase 3: Documentation and Review

- [x] Update the feature documentation and README without rewriting ADR-009's
      historical decision.
- [x] Review the complete diff for authorization, privacy, regression risk,
      unnecessary complexity, and generated or secret files.
- [x] Run the repository quality gates and `git diff --check`.

## Risks and Mitigations

| Risk                                        | Impact | Mitigation                                                                      |
| ------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| Browser-supplied identity grants access     | High   | Resolve the role only from the server-side session with `requireTechnician`.    |
| A no-op changes `updatedAt`                 | Medium | Make the SQL update conditional and return the existing row when unchanged.     |
| Restricted ticket existence leaks           | High   | Authorize before repository access and use the established not-found response.  |
| Priority editing overwrites unrelated state | High   | Update only `priority` and `updatedAt`; assert all existing fields in tests.    |
| Ticket list uses stale priority semantics   | Medium | Reuse the existing column and verify repository priority sorting after changes. |

## Boundaries

- No migration, new enum value, new role, notification, audit history,
  escalation, AI classification, or general ticket editing.
- Do not redesign ticket creation or the ticket detail page.
- Do not commit, push, merge, or create a pull request before human review.
