# Spec: Ticket Discussions and Approved Solutions

## Objective

Signed-in users can view support tickets, add comments and one-level replies, and mark useful posts. IT members can spotlight, moderate, and approve one post as a solution, resolving the ticket. Ticket owners and commenters can opt into per-ticket notifications.

## Tech Stack

React/Vite frontend; Fastify/TypeScript API; Drizzle/PostgreSQL persistence; Vitest and React Testing Library.

## Commands

- Test: `docker compose --profile tools run --rm toolchain pnpm test`
- Type check: `docker compose --profile tools run --rm toolchain pnpm typecheck`
- Build: `docker compose --profile tools run --rm toolchain pnpm build`

## Project Structure

- `apps/api/src/tickets/`: ticket and discussion contracts, routes, and repositories.
- `apps/web/src/tickets/`: ticket-detail UI and API client.
- `docs/specs/` and `docs/decisions/`: approved behavior and architectural rationale.

## Code Style

Use strict TypeScript, camelCase JSON fields, uppercase enum values, explicit input/output types, and boundary validation.

```ts
export interface CreateCommentInput {
  body: string;
  parentCommentId?: string;
}
```

## Testing Strategy

Colocate Vitest API, database-integration, and React component tests. Cover validation, authorization, persistence constraints, and accessible UI states. The repository-wide 50% coverage threshold applies.

## Boundaries

- Always: validate input, authorize every protected operation, parameterize persistence, and run quality checks.
- Ask first: new external delivery providers, role-policy changes, or changed ticket visibility.
- Never: expose password hashes or sessions, trust client authorization, or commit credentials.

## Success Criteria

- A signed-in user can create and discuss a ticket; replies are limited to one visible level.
- Users can toggle one helpful vote per post; IT can spotlight posts and approve/revoke a single solution.
- Selecting a solution resolves the ticket; revoking it reopens the ticket.
- Only ticket owners and commenters can configure or receive notifications for that ticket.
