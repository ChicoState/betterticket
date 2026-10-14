# ADR-003: Expose a Five-Stage Public Ticket Progress Lifecycle

## Status

Accepted

## Date

2026-10-07

## Context

The anonymous ticket viewer already exposes an `OPEN` status but cannot show meaningful progress. The requested tracking slice requires a small, understandable status lifecycle without introducing the deferred account, technician, and authorization systems.

## Decision

Use exactly five public statuses in this forward-only order:

```text
OPEN → UNDER_REVIEW → IN_PROGRESS → RESOLVED → COMPLETED
```

New tickets default to `OPEN`. Ticket detail pages display the current status, all lifecycle stages, and the existing `updatedAt` value as the last-updated time. Public ticket-read endpoints continue to return the status and timestamps in their current response shape.

No endpoint, repository method, UI, notification, or history feed changes a status in this slice. An authenticated and authorized staff workflow must be designed before BetterTicket can mutate ticket statuses.

## Alternatives Considered

### Anonymous status update endpoint

Rejected because any visitor could alter a public ticket without an authorization model.

### Add assignment, hold, or cancellation states

Rejected because `ASSIGNED`, `ON_HOLD`, and `CANCELLED` are outside the approved lifecycle and imply unimplemented technician workflow decisions.

### Store a status history now

Rejected because users only need the current progress indicator and last-updated value for this sprint. Auditing semantics depend on the future staff authorization model.

## Consequences

- Visitors can track current progress but cannot receive notifications or view prior transitions.
- A future staff-workflow ADR must define who can change statuses, authorization, audit history, timestamp behavior, and enforcement of the forward-only transition order.
- The enum migration is additive and preserves existing `OPEN` tickets.
