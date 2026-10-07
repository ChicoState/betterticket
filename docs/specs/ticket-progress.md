# Spec: Ticket Progress

## Objective

Let a visitor track the current progress of a public ticket from its individual page. The page shows the current status, a clear lifecycle timeline, and the date and time the ticket was last updated.

## Contract

Ticket responses continue to expose `status` and `updatedAt`. The only approved status values are `OPEN`, `UNDER_REVIEW`, `IN_PROGRESS`, `RESOLVED`, and `COMPLETED`. New tickets always start `OPEN`.

The approved forward-only lifecycle is:

```text
OPEN → UNDER_REVIEW → IN_PROGRESS → RESOLVED → COMPLETED
```

The existing public read routes remain unchanged. This feature does not add a status mutation route, a status history, notifications, assignment, hold, cancellation, authentication, or a staff interface.

## Tech Stack and Structure

- `apps/api`: Fastify response contract and Drizzle PostgreSQL enum migration.
- `apps/web`: React ticket detail presentation, API-response validation, and existing ticket component styles.
- `apps/api/drizzle`: versioned migration generated from the Drizzle schema.

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

- API route tests cover each approved status in public responses and confirm ticket creation remains `OPEN`.
- PostgreSQL integration tests prove every approved enum value persists and reads back.
- React component tests cover each current timeline stage and the last-updated timestamp.

## Boundaries

- Always: display the finite server status set with text as well as visual state, retain React escaping, and version schema changes.
- Ask first: add authentication, authorization, a technician interface, status mutation, notifications, a history feed, or any other ticket status.
- Never: expose an anonymous status-change endpoint or add `ASSIGNED`, `ON_HOLD`, or `CANCELLED`.

## Success Criteria

- A ticket detail page shows all five ordered progress stages and identifies the current one.
- A ticket detail page exposes an accessible, formatted last-updated time.
- New tickets remain `OPEN`.
- PostgreSQL and public API contracts accept exactly the five approved statuses.
- Quality, migration, coverage, build, and smoke checks pass.

## Open Questions

Which authenticated roles may make forward-only transitions, and how those transitions should be audited, remain deferred.
