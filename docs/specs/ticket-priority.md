# Spec: Ticket Priority

## Objective

Allow anonymous and authenticated ticket creators to choose `LOW`, `MEDIUM`,
or `HIGH` priority, then let authenticated technicians correct that same
priority after creation. New and existing tickets default to `MEDIUM`. Ticket
lists support database-backed priority sorting with deterministic newest-first
tie-breaking. The default list order is by votes; see the
[reply-voting spec](reply-voting.md#approved-extension-sort-tickets-by-votes).

## Contract

- `POST /api/tickets` accepts optional `priority` with values `LOW`, `MEDIUM`,
  or `HIGH`.
- `PATCH /api/tickets/:ticketId/priority` accepts `{ "priority": "LOW" |
"MEDIUM" | "HIGH" }` from an authenticated `TECHNICIAN` and returns the
  existing ticket response contract.
- Ticket responses always include priority.
- `GET /api/tickets?sort=priority` sorts `HIGH`, `MEDIUM`, `LOW`;
  `sort=newest` gives newest-first ordering, and omitting `sort` orders by votes.
- Visibility authorization is applied before the database limit.
- A changed priority refreshes `updatedAt`; setting the current value is an
  idempotent success that preserves `updatedAt`.

## Boundaries

- Ticket creators choose the initial priority. Only authenticated technicians
  may change it after creation; regular users and anonymous visitors cannot.
- Priority updates are allowed in every progress and reply status.
- Priority does not alter progress status, reply status, assignment, visibility,
  creator attribution, replies, endorsements, or escalation.
- Visibility rules remain owned by the ticket visibility implementation.
- Authorization is resolved exclusively from the server-side session through
  the shared technician guard.

## Testing Strategy

API and PostgreSQL integration tests cover validation, authentication,
authorization, defaults, persistence, idempotence, timestamp behavior, sorting,
visibility filtering, and preservation of unrelated ticket fields. React tests
cover creation, indicators, sorting, technician-only editing, loading, success,
unchanged selections, and failure recovery.

## Migration Integration

Ticket visibility owns migration `0005_ticket_visibility.sql`. Priority is the
additive migration `0008_ticket_priority.sql`; released migrations are
not rewritten.

## Approved Extension: Technician Priority Management

Issue #78 extends the original creation-and-sorting feature with manual
technician reassignment of the existing priority column. It adds no priority
levels, migration, history, notification, automatic escalation, or AI-based
classification. See [ADR-014](../decisions/014-technician-managed-ticket-priority.md).
