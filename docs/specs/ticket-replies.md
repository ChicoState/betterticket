# Spec: Baseline Ticket Replies

## Objective

Let the person who submitted a ticket and the technicians working on it hold a conversation on the ticket's page. Visitors do not sign in to create or read tickets, so any visitor can reply and replies carry no author or role. See [ADR-004](../decisions/004-anonymous-ticket-replies.md) for why replies are anonymous and unlabelled in this slice.

## Contract

A reply has this shape:

```json
{
  "id": "5d4c1f0e-6f0a-4a57-9d0b-3a0b6a1f2c11",
  "ticketId": "cc04d84c-9aee-4d35-8af3-999d861aaed6",
  "body": "Have you tried a different charger?",
  "createdAt": "2026-10-07T18:00:00.000Z"
}
```

`GET /api/tickets/:id/replies` returns `200` with `{ "replies": [] }`. Replies are ordered oldest first and limited to the 200 most recent for the ticket.

`POST /api/tickets/:id/replies` accepts `{ "body": "..." }` and returns `201` with the stored reply. `body` is required, must contain a non-whitespace character, and is at most 5,000 characters; surrounding whitespace is trimmed before storage. Unknown fields are rejected.

For both routes an ID that is not a UUID or an invalid body returns `400` with the existing `VALIDATION_ERROR` object, a well-formed ID with no ticket returns `404` with the existing `NOT_FOUND` object, and unexpected failures return `500` with the stable error object and no database details.

Posting a reply does not change the ticket's status or `updatedAt`. Replies cannot be edited or deleted.

## Pages

`/tickets/:id` shows a "Replies" section below the ticket with loading, empty, error-with-retry, and populated states, followed by a form with one "Your reply" field. A posted reply is appended to the conversation without reloading, the field is cleared, and the result is announced. A failed post keeps the draft and shows an error. The section is not shown when the ticket is missing or failed to load.

## Tech Stack and Structure

Unchanged from [ticket creation](ticket-creation.md). Replies are stored in a new `ticket_replies` table that references `tickets` and is removed with its ticket. The routes and repository methods sit beside the ticket ones in `apps/api/src/tickets` and `apps/api/src/database`; the `TicketReplies` component sits in `apps/web/src/tickets` and is rendered by `TicketDetail`.

## Testing Strategy

- API route tests prove the list shape, the empty list, creation with trimming, the `400` and `404` cases without a write, and the stable error.
- PostgreSQL integration tests prove persistence, per-ticket scoping, oldest-first ordering, the limit keeping the most recent replies, and rejection of a reply to a missing ticket.
- React component tests prove the loading, populated, empty, error, and retry states, posting, duplicate-submission protection, and the failed-post state.

## Boundaries

- Always: render reply text through React, keep the response bounded, validate at the route, and keep database errors out of responses.
- Ask first: add authentication, author names or roles, editing or deletion, notifications, attachments, or status changes on reply.
- Never: store an unverified author or role, or expose fields that are not in the reply contract.

## Success Criteria

- A visitor can read a ticket's replies, oldest first, without signing in.
- A visitor can post a reply and see it in the conversation immediately and after a reload.
- Blank and oversized replies are rejected and never stored.
- Loading, empty, failed loads, and failed posts are reported accessibly.
- Quality, coverage, build, migration, and smoke checks pass.

## Open Questions

- How replies are attributed to users and technicians once accounts exist, and how anonymous replies are shown then.
- Whether a reply should reopen a ticket or notify anyone once statuses and accounts exist.
- Paging through more than 200 replies on one ticket.
