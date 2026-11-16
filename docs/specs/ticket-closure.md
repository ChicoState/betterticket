# Spec: Owner-Managed Ticket Closure

## Objective

Let a signed-in ticket owner close or reopen replies on their own ticket without changing its existing progress lifecycle.

## Contract

Ticket responses retain the five-value `status` progress field and add `replyStatus`, which is `OPEN` or `CLOSED`, plus `canManageReplyStatus`. New and existing tickets default to `OPEN`.

`PATCH /api/tickets/:id/reply-status` accepts `{ "replyStatus": "OPEN" | "CLOSED" }`. It requires the authenticated private creator of the ticket. It returns `401` when unsigned, `403` when the caller is not the owner, and `404` when absent. Creator IDs are never returned.

`POST /api/tickets/:id/replies` returns `409` with `TICKET_CLOSED` when `replyStatus` is `CLOSED`; existing replies remain readable. Progress status is never changed by close/reopen.

### Owner completion confirmation

`POST /api/tickets/:id/complete` lets the ticket's creator confirm a `RESOLVED` ticket as `COMPLETED`. It takes no body and returns the updated ticket. It returns `401` when unsigned, `403 FORBIDDEN` when the caller is not the creator (including every caller for a ticket with no stored creator), `404` when absent, and `400 INVALID_STATUS_TRANSITION` unless the ticket is `RESOLVED`. Confirming an already `COMPLETED` ticket returns it unchanged. Completion does not change `replyStatus`, and close/reopen still never change progress. Because the owner is the actor, no notification is created.

The ticket page shows a **Confirm completed** button beside the close/reopen control only when `canManageReplyStatus` is true and the status is `RESOLVED`.

## Testing Strategy

- API tests cover owner close/reopen, unsigned/non-owner denial, and closed-reply rejection.
- PostgreSQL tests cover default-open persistence and owner updates.
- React tests cover the owner controls and the closed reply state.
- API, PostgreSQL, and React tests cover owner-only completion of resolved tickets.

## Boundaries

- Always: enforce ownership and closure server-side, retain private anonymous-post attribution, and use migrations for persistence changes.
- Ask first: allow technicians to manage tickets they do not own, alter the progress lifecycle, or attribute replies.
- Never: expose creator IDs or permit anonymous visitors to change reply status.

## Success Criteria

- Owners can close and reopen their own tickets, including anonymously displayed posts.
- Owners can confirm a resolved ticket as completed; nobody else can.
- Closed tickets refuse new replies while retaining existing conversation history.
- Open tickets and progress statuses preserve their prior behavior.
