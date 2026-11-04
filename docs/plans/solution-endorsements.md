# Implementation Plan: Suggested Solutions and Technician Endorsements

## Overview

Implement `docs/specs/solution-endorsements.md` and ADR-010. Add a kind to replies, add a table of
technician endorsements, add PUT and DELETE routes for endorsements that can optionally resolve
the ticket, and split the reply UI into solution and discussion sections with technician controls.

## Architecture Decisions

- Keep the route-to-repository structure. Endorsement with `markResolved` runs in one Drizzle
  transaction. The locked status transition inside `updateStatus` moves into a shared helper that
  takes a transaction, so both paths apply the same rule and send the same notification.
- Load endorsements for the listed replies in one query with `reply_id IN (...)`, joined to
  `users.name`, and group them in memory. This avoids an N+1 query pattern and stays bounded by
  `replyListLimit`.
- Compute `isOwn` in the route from the session user. The repository returns `technicianId`
  internally, and `toReply` removes it.
- Group and sort the replies on the client. The API keeps returning the existing oldest-first
  list.

## Task List

### Phase 1: Persistence

- [x] Add the `reply_kind` enum, the `ticket_replies.kind` column, and the `reply_endorsements`
      table, then generate the migration.
  - Acceptance: the migration is additive; existing rows default to `COMMENT`; the unique
    `(reply_id, technician_id)` constraint exists; and the foreign keys cascade.
  - Verify: inspect the SQL, then run `pnpm db:migrate`.

### Phase 2: Contract and Reply API

- [x] Extend the `Reply` contract and its schemas with `kind` and `endorsements`, and accept an
      optional `kind` on POST.
- [x] Have `listRecentReplies` and `createReply` return the kind and the endorsements.
  - Acceptance: POST defaults to `COMMENT`; the list includes endorsements; `isOwn` is correct;
    and no IDs leak.
  - Verify: route tests and integration tests.

### Phase 3: Endorsement API

- [x] Move the status-transition logic into a helper that takes a transaction.
- [x] Add `endorseReply` (an upsert with optional resolve) and `withdrawEndorsement` to the
      repository.
- [x] Add the `PUT` and `DELETE /api/tickets/:ticketId/replies/:replyId/endorsement` routes.
  - Acceptance: every error case in the spec; nothing is written on an invalid transition; one
    notification on resolve; and existing status-route tests still pass.
  - Verify: route tests and PostgreSQL integration tests, including the rollback.

### Checkpoint: API complete

- [x] Type checking, linting, and API tests pass. Review the contract before UI work starts.

### Phase 4: Web

- [x] Add the `ticket-api.ts` types and the `endorseReply` and `withdrawEndorsement` client
      functions.
- [x] Add the kind radio group to the post form, and split `TicketReplies` into solution and
      discussion sections with the specified ordering.
- [x] Add a `SolutionEndorsement` component with the endorse, edit-notes, and withdraw flows, and
      the resolve checkbox when the ticket is `IN_PROGRESS`.
- [x] Wire `TicketDetail` to pass the technician flag and status, and to apply the returned
      ticket.
  - Acceptance: all states in the Pages section of the spec; accessible labels and live regions;
    and no controls for anyone who is not a technician.
  - Verify: component tests, an end-to-end API check against `db:example`, and a manual browser
    check by the product owner.

### Phase 5: Data and Docs

- [x] Add example solutions and endorsements to `db:example`.
- [x] Update README, AGENTS.md (Status), and the "Open Questions" in `ticket-replies.md` to point
      to ADR-010. Mark ADR-010 as Accepted.

### Checkpoint: Complete

- [x] Formatting, linting, type checking, migrations, tests, coverage, build, and
      `git diff --check` pass.
- [ ] Smoke checks pass. Blocked locally: another Compose project held host ports 5432 and 8333.

## Risks and Mitigations

| Risk                                             | Impact | Mitigation                                                                    |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------- |
| Endorsing a reply via a different ticket's URL   | High   | Repository filters by both `reply_id` and `ticket_id`; tested.                |
| Endorsement reveals that a private ticket exists | High   | Visibility check runs first and returns the generic `404`.                    |
| Resolve skips stages or double-notifies          | Medium | Shared locked transition helper, same-status handled as no-op.                |
| Technician user IDs leak through endorsements    | Medium | Response schema allows only `technicianName` and `isOwn`; route test asserts. |
| Double-submit creates duplicate endorsements     | Low    | Unique constraint plus upsert; UI disables the form while it is pending.      |
