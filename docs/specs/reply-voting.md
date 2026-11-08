# Spec: Authenticated Reply Voting

## Status

Approved by the product owner on 2026-11-08. Requested behavior: logged-in users can upvote and downvote; visitors cannot vote. Voting applies to ticket replies, matching the existing unfinished voting component and schema draft.

## Objective and Success Criteria

- Any authenticated USER or TECHNICIAN can upvote or downvote a reply.
- Each account has at most one vote per reply. Selecting the same direction again removes the vote; selecting the other direction changes it.
- Votes persist across page reloads. Readers see upvote and downvote totals and the score (upvotes minus downvotes).
- Visitors can read totals, but voting buttons are disabled with a visible sign-in link. Buttons remain disabled until the current session is known.
- The API rejects vote writes and removals without a valid, unexpired server-side session with 401 AUTHENTICATION_REQUIRED. A client-supplied user ID never chooses the voter.
- Reply creation and reading remain public. Voting does not change ticket status, ticket timestamps, or reply ordering.

## Contract

Extend reply responses with integer `upvotes` and `downvotes` (minimum zero) and `userVote` (1, -1, or null). Visitors receive null for `userVote`; authenticated readers receive only their own selection. Do not return voter identities. Personalized reply responses use `Cache-Control: private, no-store`.

`PUT /api/tickets/:ticketId/replies/:replyId/vote` accepts exactly `{ "value": 1 }` or `{ "value": -1 }`. `DELETE` on the same URL removes the caller's vote. Both return 200 with the authoritative vote state `{ "upvotes": 0, "downvotes": 0, "userVote": null }` using the actual stored values.

Validate both IDs as UUIDs, reject unknown body fields and invalid directions with 400, and return 404 when the reply does not belong to the specified ticket or does not exist. Authentication is checked before any vote mutation. Unexpected errors use the existing stable 500 response.

## Storage and Security

Complete the existing `ticket_reply_votes` draft with cascading reply/user foreign keys, uniqueness on `(reply_id, user_id)`, and a database check restricting value to -1 or 1. Generate a versioned Drizzle migration. Upsert or delete only the session user's row and scope the target reply to its ticket. Concurrent requests must not create duplicate votes. Use the existing session cookie and parameterized Drizzle queries; introduce no dependencies.

## Tech Stack and Project Structure

Use the existing React/Vite, Fastify, Drizzle, PostgreSQL, TypeScript, and Vitest stack. API contracts and routes live in `apps/api/src/tickets`; persistence and schema live in `apps/api/src/database`; migrations live in `apps/api/drizzle`; UI and client code live in `apps/web/src/tickets`. Colocate tests with the relevant implementation.

## Code Style

Follow existing typed contracts, explicit result unions, double quotes, semicolons, and Prettier formatting. Example:

```typescript
export type ReplyVote = -1 | 1;
export interface ReplyVoteState {
  upvotes: number;
  downvotes: number;
  userVote: ReplyVote | null;
}
```

## Testing Strategy

- Route tests: both roles can vote; absent, invalid, expired, or revoked sessions cannot write or remove votes; invalid inputs and cross-ticket reply IDs cannot mutate data; identity comes from the session.
- PostgreSQL tests: persistence, upsert idempotency, direction changes, removal, per-user isolation, uniqueness under concurrent writes, and correct totals.
- UI tests: disabled visitor controls, session-loading behavior, successful voting, toggling, switching, duplicate-click protection, reload state, and visible save/session-expiry errors without false totals.
- Browser verification: sign in, vote on a reply, reload, switch/remove the vote, sign out, and verify the visitor controls and direct API rejection.

## Commands

```sh
docker compose --profile tools run --rm toolchain pnpm install --frozen-lockfile
docker compose --profile tools run --rm toolchain pnpm db:generate
docker compose --profile tools run --rm toolchain pnpm db:migrate
docker compose --profile tools run --rm toolchain pnpm format:check
docker compose --profile tools run --rm toolchain pnpm lint
docker compose --profile tools run --rm toolchain pnpm typecheck
docker compose --profile tools run --rm toolchain pnpm test
docker compose --profile tools run --rm toolchain pnpm coverage
docker compose --profile tools run --rm toolchain pnpm build
git diff --check
```

Database tests must use an isolated test database, since the existing integration tests delete fixtures. Do not run them against the developer's persistent database. Run the infrastructure smoke test only with available host ports and isolated volumes.

## Boundaries

- Always: enforce authorization on the server, preserve existing user work, maintain anonymous reply access, and validate inputs and responses.
- Ask first: add reply attribution, vote-based sorting, or public voter lists. Ticket-level voting is authorized by the extension below.
- Never: trust a submitted user ID, store credentials in tracked files, delete local data, or alter unrelated product behavior.

## Open Questions

None blocking review. This proposal uses reply voting because the existing draft targets replies.

## Approved Extension: Ticket Voting and Thumb Icons

Requested and authorized by the product owner on 2026-11-08: support upvotes/downvotes on the request (ticket) itself, and use thumbs-up/thumbs-down icons for both ticket and reply voting.

- Show ticket voting at the bottom of the post on `/tickets/:id`, below the ticket content and above the replies, independently of reply votes. Reuse the existing login requirement, one-vote-per-account rule, toggle/removal behavior, error handling, and public totals.
- `GET /api/tickets/:ticketId/vote` publicly returns vote state, with only the authenticated viewer's selection and `Cache-Control: private, no-store`. A missing ticket returns 404.
- `PUT` and `DELETE` on that URL set or remove the session user's ticket vote. PUT accepts exactly `{ "value": 1 }` or `{ "value": -1 }`. Require a valid session, validate IDs and bodies, return authoritative vote state, and use the existing 400/401/404/500 errors.
- Add `ticket_votes` with ticket/user cascading foreign keys, uniqueness on `(ticket_id, user_id)`, and a value check restricting votes to -1 or 1. Use an additive Drizzle migration. Ticket voting does not change status, timestamps, reply votes, or queue ordering.
- Share the voting interaction UI and render small inline SVG thumb icons, with readable accessible button labels, pressed state, and visible counts. Avoid adding an icon dependency.
- Verify both roles, anonymous denial, persistence, switching/removal, per-user isolation, repeated/concurrent votes, and ticket/reply independence through route, database, component, and browser tests. Use the existing commands and isolated database policy above.

## Approved Extension: Vote from the Tickets List

Requested by the product owner on 2026-11-08: show ticket vote counts and thumbs-up/down controls on every card in `/tickets`, allowing authenticated users to vote while browsing without opening a ticket or visiting the new-ticket form. Keep the existing controls at the bottom of the detail post as well.

`GET /api/tickets` now includes a required `votes` object on each ticket, using the existing vote-state shape. Resolve the viewer from the session, return only that viewer's selection, and use `Cache-Control: private, no-store`. Fetch vote states for all listed IDs in one bounded database query. No extra per-card vote-state requests are needed. Existing authenticated PUT/DELETE endpoints handle votes from either page.

Visitors see counts and disabled controls with a sign-in link. Session resolution and identity changes must not enable voting or show another account's selection. Preserve newest-first ordering, error/retry behavior, and the existing 100-ticket limit. Test direct list voting, changing/removing a vote, independent cards, reload persistence, visitor blocking, and viewer changes.
