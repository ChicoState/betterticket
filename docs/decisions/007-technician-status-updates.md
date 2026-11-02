# ADR-007: Allow Technicians to Advance Ticket Status

## Status

Accepted. Partially superseded by
[ADR-010](010-technician-status-updates-and-owner-notifications.md): technicians may no longer
set `COMPLETED`, and status changes now notify the ticket creator.

## Date

2026-10-20

## Context

ADR-003 established the public five-stage ticket progress lifecycle but intentionally deferred all
status mutation until authentication and authorization existed. BetterTicket now has provisioned
users, server-side sessions, and the `TECHNICIAN` role through the technician-assignment MVP.

The product needs technicians to reflect work progress without changing the public lifecycle,
introducing a second authorization model, or coupling this sprint to the saved notification work.

## Decision

- Preserve exactly five statuses and their existing order:

  ```text
  OPEN → UNDER_REVIEW → IN_PROGRESS → RESOLVED → COMPLETED
  ```

- Add `PATCH /api/tickets/:ticketId/status` with a validated `{ "status": ... }` body and the
  existing ticket response contract.
- Authorize the endpoint using the existing server-side session and shared `requireTechnician`
  guard. Only an authenticated user whose stored role is `TECHNICIAN` may update status. Any
  technician may update any ticket; the update is not limited to the assigned technician.
- Allow only the adjacent next status. Reject skipped stages, backward transitions, and all changes
  from terminal `COMPLETED`.
- Treat a request for the ticket's current status as an idempotent success. It returns the existing
  ticket without changing `updatedAt`.
- Reuse the existing status enum, `updatedAt` field, ticket response, public timeline, and error
  conventions. No database migration is part of this decision.
- Exclude notifications and status-history/audit records from this sprint.

## Alternatives Considered

### Allow any authenticated user to update status

Rejected because status mutation is a staff workflow and the existing authorization model already
distinguishes technicians from regular users.

### Restrict updates to the assigned technician

Rejected for this sprint because the existing assignment decision permits any technician to manage
any ticket. Assignment-based authorization would be a new policy with separate product scope.

### Permit skipped or backward transitions

Rejected because the public progress timeline represents ordered work stages and backward movement
would make the lifecycle ambiguous. Reopening and exception states require a separately designed
workflow.

### Add status history or notifications with the mutation

Rejected because audit semantics, notification recipients, and ownership rules are not part of this
sprint. The saved notification-branch/stash work also uses a conflicting status and ownership model.

### Add a new status or database column

Rejected because the existing enum and `updatedAt` field provide the required current-state model.

## Consequences

- Technicians can advance tickets through the existing lifecycle while public viewers continue to
  use the same read contract and progress timeline.
- Repository transition validation becomes the source of truth for lifecycle rules; route validation
  remains responsible for authentication, role authorization, and request shape.
- Same-status retries are safe and do not make the ticket appear newly updated.
- No audit trail or notification is produced by a status change in this sprint.
- A future workflow may need a new ADR for reopening, exception states, status history, or
  notification behavior.
