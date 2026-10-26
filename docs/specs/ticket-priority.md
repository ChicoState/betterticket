# Spec: Ticket Priority

## Objective

Allow anonymous and authenticated ticket creators to select `LOW`, `MEDIUM`, or
`HIGH` priority. New and existing tickets default to `MEDIUM`. Ticket lists
remain newest-first by default and may be sorted by priority, with equal
priorities ordered newest-first and then by UUID for deterministic results.

## Contract

- `POST /api/tickets` accepts optional `priority`, one of `LOW`, `MEDIUM`, or
  `HIGH`; omitted priority is stored as `MEDIUM`.
- Ticket responses include the non-null `priority` field.
- `GET /api/tickets` accepts optional `sort=priority`; omitted or `sort=newest`
  uses the existing newest-first ordering.
- Unknown fields and invalid priority or sort values are rejected with the
  existing boundary validation behavior.

## Project Structure

- `apps/api/src/database`: PostgreSQL schema, migration, repository, and
  integration tests.
- `apps/api/src/tickets`: API contracts, route tests, and repository interface.
- `apps/web/src/tickets`: creation form, list sorting, priority indicators, and
  client contract tests.
- `docs/decisions/009-ticket-priority.md`: persistence and ordering decision.

## Code Style

Priority values use the existing uppercase enum convention:

```ts
export const ticketPriorities = ["LOW", "MEDIUM", "HIGH"] as const;
export type TicketPriority = (typeof ticketPriorities)[number];
```

## Testing Strategy

- API tests cover validation, defaulting, and response serialization.
- PostgreSQL integration tests cover persistence, all priority values, default
  values, database ordering, equal-priority tie-breaking, and limit behavior.
- React tests cover form submission, priority indicators, and sorting controls.
- Existing ticket tests continue to run unchanged in behavior apart from the
  additive response field.

## Boundaries

- Always validate priority at the API boundary and use parameterized Drizzle
  queries.
- Always apply sorting in PostgreSQL before the list limit.
- Do not allow priority updates after creation in this issue.
- Do not alter status transitions, technician assignment, or visibility rules.
- Do not reimplement ticket visibility when it is absent from this branch.

## Success Criteria

- Both anonymous and authenticated users can submit all three priorities.
- Omitted priority and pre-existing rows resolve to `MEDIUM`.
- Cards and details display priority.
- Newest-first remains the default; priority sorting returns HIGH, MEDIUM, LOW
  and honors the limit.
- Formatting, linting, typechecking, migrations, tests, coverage, build, and
  smoke verification pass.

## Migration Integration Note

This branch currently ends at migration `0004`. PR #57 is not in this checkout
and may also introduce the next migration number. When integrating both
branches, preserve both SQL files and resequence only the migration filenames,
journal entries, and generated snapshots as one reviewed operation if their
numbers collide. Do not modify an already-applied migration in place.
