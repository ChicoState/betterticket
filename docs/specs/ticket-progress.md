# Spec: Technician Ticket Status Updates

## Objective

Let an IT Technician update a ticket's status so the public ticket page accurately reflects the
progress of work. Visitors continue to see the current status, the ordered lifecycle timeline, and
the date and time the ticket was last updated.

## Contract

Ticket responses continue to expose `status` and `updatedAt`. The only approved status values are
`OPEN`, `UNDER_REVIEW`, `IN_PROGRESS`, `RESOLVED`, and `COMPLETED`. New tickets always start
`OPEN`.

The approved forward-only lifecycle is:

```text
OPEN → UNDER_REVIEW → IN_PROGRESS → RESOLVED → COMPLETED
```

Add the technician-protected endpoint:

```text
PATCH /api/tickets/:ticketId/status
Body: { "status": "UNDER_REVIEW" }
Response: the existing ticket response contract
```

The endpoint resolves the caller through the existing server-side session. Only an authenticated
user with the existing `TECHNICIAN` role may change status. The endpoint does not restrict updates
to the assigned technician.

Status changes may move only to the next adjacent stage in the lifecycle. Skipped stages,
backward transitions, and changes from `COMPLETED` are rejected. Setting the current status again
is an idempotent success and does not change `updatedAt`.

> **Amended by ADR-010:** technicians may advance a ticket only as far as `RESOLVED`.
> `RESOLVED → COMPLETED` is reserved for the ticket owner's confirmation, and each status change
> notifies the ticket creator. See `docs/specs/ticket-status-notifications.md`.

Existing public read routes and the public progress timeline remain available. This feature does
not add notifications, status history or audit records, new roles, assignment rules, hold states,
cancellation states, or a separate progress endpoint.

## Tech Stack and Structure

- `apps/api`: Fastify status route, shared contract, repository transition validation, and existing
  session authorization.
- `apps/web`: React ticket detail presentation, technician status controls, API-response validation,
  and existing ticket component styles.
- `apps/api/drizzle`: existing status enum and `updatedAt` schema; no new migration is expected.

## Commands

```sh
docker compose --profile tools run --rm toolchain pnpm db:migrate
docker compose --profile tools run --rm toolchain pnpm format:check
docker compose --profile tools run --rm toolchain pnpm lint
docker compose --profile tools run --rm toolchain pnpm typecheck
docker compose --profile tools run --rm toolchain pnpm test
docker compose --profile tools run --rm toolchain pnpm coverage
docker compose --profile tools run --rm toolchain pnpm build
bash scripts/smoke.sh
```

## Testing Strategy

- API route tests cover authentication, technician authorization, request validation, success,
  missing tickets, invalid transitions, and the existing ticket response contract.
- Repository and PostgreSQL integration tests cover every adjacent transition, rejected skips and
  backwards moves, terminal `COMPLETED`, idempotent same-status updates, and `updatedAt` behavior.
- React component tests cover the public timeline, technician-only controls, successful updates,
  loading/disabled states, authorization errors, invalid-transition errors, and retry behavior.
- Accessibility checks verify that status controls have clear labels, keyboard operation, and
  announced errors/status changes without relying on color alone.

## Boundaries

- Always: resolve authorization from the server-side session, validate the finite server status set,
  enforce adjacent forward transitions in the repository, preserve React escaping, and keep the
  public timeline text-accessible as well as visual.
- Ask first: add a database migration, status history/audit records, notifications, new roles,
  assigned-technician restrictions, or any status outside the approved five-stage lifecycle.
- Never: trust a client-supplied role or user ID, expose an anonymous status-change endpoint, allow
  skipped or backward transitions, or add `ASSIGNED`, `ON_HOLD`, or `CANCELLED`.

## Success Criteria

- A ticket detail page shows all five ordered progress stages and identifies the current one.
- An authenticated `TECHNICIAN` can update a ticket through each adjacent forward stage using the
  protected endpoint and technician controls.
- Unauthenticated users and authenticated `USER` accounts cannot change status.
- Skipped, backward, and post-`COMPLETED` transitions are rejected.
- Same-status updates succeed without changing `updatedAt`.
- A ticket detail page exposes an accessible, formatted last-updated time and reflects successful
  status changes.
- New tickets remain `OPEN`, and public responses continue to accept exactly the five statuses.
- Notifications and status history remain absent from this sprint.
- Quality, coverage, build, and smoke checks pass; no new migration is required unless implementation
  proves one necessary.

## Deferred Decisions

Status updates are authorized for any authenticated `TECHNICIAN`, matching the existing assignment
authorization model. Assignment-based restrictions and status history/audit semantics remain out of
scope.
