# Spec: Baseline Ticket Creation

## Objective

Deliver issue #30 as the first BetterTicket product slice. An anonymous visitor can describe a problem, submit it, and receive confirmation only after the ticket has been stored in PostgreSQL.

## Contract

`POST /api/tickets` accepts JSON with:

- `title`: required, trimmed, 1–160 characters.
- `description`: required, trimmed, 1–5,000 characters.
- `setup`: required, trimmed, 1–3,000 characters.
- `additionalInformation`: optional, trimmed, at most 3,000 characters.

Unknown fields are rejected. A successful response is `201` and contains the stored ticket's UUID, submitted fields, `OPEN` status, and ISO-8601 creation/update timestamps. Invalid requests return `400` with a stable error object and are not persisted.

## Tech Stack and Structure

- `apps/api`: Fastify 5 API, Drizzle ORM, PostgreSQL schema, and versioned migrations.
- `apps/web`: React 19/Vite 7 single-page ticket form.
- Ticket-specific contract, route, repository, component, and tests remain in focused modules so later fields can be added additively.

## Commands

```sh
docker compose --profile tools run --rm toolchain pnpm db:migrate
docker compose --profile tools run --rm --service-ports toolchain pnpm dev
docker compose --profile tools run --rm toolchain pnpm test
docker compose --profile tools run --rm toolchain pnpm coverage
```

## Code Style

Use strict TypeScript, camelCase API fields, uppercase enum values, explicit input/output types, and boundary validation:

```ts
export interface CreateTicketInput {
  title: string;
  description: string;
  setup: string;
  additionalInformation?: string;
}
```

## Testing Strategy

- API route tests prove valid creation, normalization, validation failures, and stable errors.
- PostgreSQL integration tests prove a created ticket survives a database round trip.
- React component tests prove form submission, pending state, success confirmation, and server errors.
- The repository-wide 50% floor applies to lines, functions, branches, and statements.

## Boundaries

- Always: validate untrusted input, use parameterized Drizzle queries, escape rendered text through React, and version schema changes.
- Ask first: add authentication, attachments, contact data, ticket reading, or workflow transitions.
- Never: store production secrets, accept unknown request properties, or expose database errors to clients.

## Success Criteria

- A visitor can submit the four approved fields without signing in.
- The ticket is stored in PostgreSQL with server-generated ID, status, and timestamps.
- Invalid or oversized input is rejected without a database write.
- The UI is keyboard accessible and reports submission success or failure.
- Quality, coverage, build, migration, and smoke checks pass.

## Open Questions

None for this slice. Authentication, ownership, reading tickets, and technician workflows remain deferred.
