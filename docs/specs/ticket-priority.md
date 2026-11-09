# Spec: Ticket Priority

## Objective

Allow anonymous and authenticated ticket creators to choose `LOW`, `MEDIUM`,
or `HIGH` priority. New and existing tickets default to `MEDIUM`. Ticket
lists support database-backed priority sorting with deterministic newest-first
tie-breaking. The default list order is by votes; see the
[reply-voting spec](reply-voting.md#approved-extension-sort-tickets-by-votes).

## Contract

- `POST /api/tickets` accepts optional `priority` with values `LOW`, `MEDIUM`,
  or `HIGH`.
- Ticket responses always include priority.
- `GET /api/tickets?sort=priority` sorts `HIGH`, `MEDIUM`, `LOW`;
  `sort=newest` gives newest-first ordering, and omitting `sort` orders by votes.
- Visibility authorization is applied before the database limit.

## Boundaries

- Priority is creation-only for this issue.
- Priority does not alter status, assignment, or escalation.
- Visibility rules remain owned by the ticket visibility implementation.

## Testing Strategy

API and PostgreSQL integration tests cover validation, defaults, persistence,
sorting, visibility filtering, and limit ordering. React tests cover creation,
indicators, and the sorting control.

## Migration Integration

Ticket visibility owns migration `0005_ticket_visibility.sql`. Priority is the
additive migration `0008_ticket_priority.sql`; released migrations are
not rewritten.
