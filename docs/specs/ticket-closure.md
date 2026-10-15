# Spec: Owner-Managed Ticket Closure

## Objective

Let a signed-in ticket owner close or reopen replies on their own ticket without changing its existing progress lifecycle.

## Contract

Ticket responses retain the five-value `status` progress field and add `replyStatus`, which is `OPEN` or `CLOSED`, plus `canManageReplyStatus`. New and existing tickets default to `OPEN`.

`PATCH /api/tickets/:id/reply-status` accepts `{ "replyStatus": "OPEN" | "CLOSED" }`. It requires the authenticated private creator of the ticket. It returns `401` when unsigned, `403` when the caller is not the owner, and `404` when absent. Creator IDs are never returned.

`POST /api/tickets/:id/replies` returns `409` with `TICKET_CLOSED` when `replyStatus` is `CLOSED`; existing replies remain readable. Progress status is never changed by close/reopen.

## Testing Strategy

- API tests cover owner close/reopen, unsigned/non-owner denial, and closed-reply rejection.
- PostgreSQL tests cover default-open persistence and owner updates.
- React tests cover the owner controls and the closed reply state.

## Boundaries

- Always: enforce ownership and closure server-side, retain private anonymous-post attribution, and use migrations for persistence changes.
- Ask first: allow technicians to manage tickets they do not own, alter the progress lifecycle, or attribute replies.
- Never: expose creator IDs or permit anonymous visitors to change reply status.

## Success Criteria

- Owners can close and reopen their own tickets, including anonymously displayed posts.
- Closed tickets refuse new replies while retaining existing conversation history.
- Open tickets and progress statuses preserve their prior behavior.
