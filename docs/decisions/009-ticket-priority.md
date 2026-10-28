# ADR-009: Store and Sort Ticket Priority in PostgreSQL

## Status

Accepted

## Date

2026-10-26

## Context

Ticket priority must persist across API and database round trips and must be
sorted before the existing ticket-list limit. Existing tickets need a safe
default.

## Decision

Store priority as a PostgreSQL enum with values `LOW`, `MEDIUM`, and `HIGH`.
The non-null column defaults to `MEDIUM`. Priority sorting uses an explicit
database `CASE` ordering (`HIGH`, `MEDIUM`, `LOW`), followed by descending
creation time and ticket ID. Visibility filtering is applied in the same
repository query before `LIMIT`.

Priority is creation-only; it does not change status or technician assignment.

## Alternatives Considered

- Numeric priority was rejected because the named enum is the API contract.
- Frontend-only sorting was rejected because it sorts after the response limit.
- Implicit PostgreSQL enum ordering was rejected in favor of an auditable
  explicit ordering expression.

## Consequences

Existing rows receive `MEDIUM` through the migration default. Migration `0005`
remains the released ticket visibility migration; priority is migration
`0008`. Neither released migration is rewritten; the previously applied priority SQL is
carried forward under the new migration number without replaying it.
