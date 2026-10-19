# ADR-006: Enforce Ticket Visibility Through Stored Policy and Session Ownership

## Status

Accepted

## Date

2026-10-19

## Context

Ticket conversations now support public, authenticated-user, and creator/technician access. The
existing ticket creator relationship is private and is already retained when a signed-in user posts
anonymously. Authorization must therefore work for anonymous visitors, regular users, technicians,
and historic tickets without trusting browser-provided identity data.

## Decision

- Store `PUBLIC`, `AUTHENTICATED`, or `PRIVATE` in a PostgreSQL enum column on every ticket.
- Default the column to `PUBLIC` so existing tickets preserve their prior behavior.
- Resolve the current viewer only from the server-side session.
- Treat the creator relationship as the ownership check for private tickets; technicians may access
  every private ticket.
- Return private ownership only through authorization decisions; never include the creator ID in API
  responses.
- Return the existing generic not-found response for unauthorized ticket and reply reads/writes so
  direct URLs do not reveal whether a restricted ticket exists.

## Consequences

Visibility is enforced consistently for list, detail, reply-list, and reply-create operations. A
signed-in anonymous poster retains access to their own private ticket while their display name remains
hidden. Visibility is selected at creation time only; editing it is intentionally out of scope.
