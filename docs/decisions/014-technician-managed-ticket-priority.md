# ADR-014: Allow Technicians to Manage Ticket Priority

## Status

Accepted

## Date

2026-11-18

## Context

ADR-009 introduced a creator-selected PostgreSQL ticket priority and explicitly
limited it to creation. IT technicians need to correct that priority after
reviewing a ticket without creating a second priority field or changing the
existing sorting behavior. The update must use the established session and role
authorization boundary and must not affect any other ticket workflow state.

## Decision

Add `PATCH /api/tickets/:ticketId/priority` with a body containing one existing
`LOW`, `MEDIUM`, or `HIGH` value. The route uses the shared
`requireTechnician` guard and returns the existing ticket response contract.

Update the existing `tickets.priority` column directly. A changed value also
updates `updatedAt`; assigning the current value is an idempotent success that
does not change `updatedAt`. Priority changes are independent of progress
status, reply status, technician assignment, visibility, ownership, replies,
endorsements, and notifications.

The ticket detail page continues to show priority to every viewer and exposes a
labeled selector and save action only to authenticated technicians.

## Alternatives Considered

- A separate technician priority was rejected because creators and technicians
  intentionally operate on one canonical priority used by existing sorting.
- Client-only authorization was rejected because hidden controls do not protect
  the API.
- A general ticket-edit endpoint was rejected because it would broaden both the
  contract and authorization surface beyond this feature.
- Priority-change history and notifications were deferred because issue #78
  explicitly excludes them.

## Consequences

- Creator-selected initial priority and the `MEDIUM` default remain unchanged.
- Technicians can make any direct transition among the three priority values,
  including on completed or reply-closed tickets.
- Existing priority sorting automatically reflects updated values because it
  reads the same PostgreSQL column.
- No schema migration, new role, or new dependency is required.
- ADR-009 remains the record of the original creation-and-sorting decision and
  is amended only for post-creation ownership of priority changes.
