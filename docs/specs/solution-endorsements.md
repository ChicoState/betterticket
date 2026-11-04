# Spec: Suggested Solutions and Technician Endorsements

> Status: **Approved** 2026-10-28 (ADR-010 accepted).

## Objective

Turn the ticket reply thread into a place where people suggest fixes. When someone posts on a
ticket, they choose whether it is a **suggested solution** or a **comment**. IT technicians can
**endorse** a suggested solution and add optional notes, so readers can tell which fixes IT
trusts. An endorsement can also mark the ticket `RESOLVED` in the same step.

User stories:

- As a visitor who can reply to a ticket, I can post either a suggested solution or a comment.
- As a reader, I see suggested solutions apart from the discussion. Endorsed solutions come first
  and show the endorsing technician's name, their notes, and the time.
- As a technician, I can endorse any suggested solution with optional notes, change my notes, or
  withdraw my endorsement.
- As a technician, when I endorse a solution on an `IN_PROGRESS` ticket, I can also mark the
  ticket `RESOLVED`. That sends the usual status notification to the ticket owner.

## Assumptions

1. Reply authorship is unchanged (ADR-004/005). Solutions and comments stay anonymous. Only the
   endorsement is attributed, and its technician is taken from the server-side session.
2. Existing replies become `COMMENT`, because nobody posted them as proposed solutions. We will not
   guess a kind for old replies.
3. A reply's kind is chosen when it is posted and cannot be changed later. Replies still cannot be
   edited or deleted.
4. "Mark resolved" follows the existing transition rule in `canTechnicianChangeStatus`. It is
   offered only when the ticket is `IN_PROGRESS`, the one status that may move to `RESOLVED`.
   Technicians cannot skip stages through endorsement.
5. Each technician can endorse a given solution once. Many technicians can endorse the same
   solution, and a ticket can have many endorsed solutions.
6. An endorsement stays visible if its technician is later changed back to `USER`. That user can
   no longer change or withdraw it. A technician account that is deleted takes its endorsements
   with it, through a cascade.
7. Endorsing does not create its own notification. The only notification comes from the existing
   status-change path when "mark resolved" is used.

## Contract

### Reply shape (extended)

```json
{
  "id": "5d4c1f0e-6f0a-4a57-9d0b-3a0b6a1f2c11",
  "ticketId": "cc04d84c-9aee-4d35-8af3-999d861aaed6",
  "kind": "SOLUTION",
  "body": "Reinstall the printer driver from the vendor site.",
  "createdAt": "2026-10-28T18:00:00.000Z",
  "endorsements": [
    {
      "id": "0b7e…",
      "technicianName": "Dana Lee",
      "notes": "Confirmed on the lab machines; use v4.2, not v5.",
      "createdAt": "2026-10-28T19:00:00.000Z",
      "updatedAt": "2026-10-28T19:00:00.000Z",
      "isOwn": true
    }
  ]
}
```

- `kind` is `"SOLUTION"` or `"COMMENT"`. A `COMMENT` always has `endorsements: []`.
- Endorsements are ordered oldest first. `notes` is a string or `null`. `isOwn` is true only when
  the viewer is the endorsing technician. Endorsements never include a user ID or username.

### List replies

`GET /api/tickets/:id/replies` keeps its visibility rules, its 200-reply limit, and its
oldest-first ordering. Each reply now carries `kind` and `endorsements`. The client groups and
sorts the replies for display.

### Post reply

`POST /api/tickets/:id/replies` accepts `{ "body": "...", "kind": "SOLUTION" | "COMMENT" }`.
`kind` is optional and defaults to `"COMMENT"`, so older clients keep working. All other
validation is unchanged.

### Endorse or update notes (technician)

`PUT /api/tickets/:ticketId/replies/:replyId/endorsement` accepts:

```json
{ "notes": "optional, ≤ 2000 chars", "markResolved": false }
```

- This route creates or replaces the caller's endorsement of the reply. `notes` is trimmed, and an
  empty or missing value is stored as `null`. Unknown fields are rejected.
- It returns `200` with `{ "reply": Reply, "ticket": Ticket }`. The ticket is included so the page
  can show a status change.
- When `markResolved` is `true`, the endorsement, the move from `IN_PROGRESS` to `RESOLVED`, and
  the owner notification are written in **one transaction** using the existing status-update
  logic. A ticket that is already `RESOLVED` is left unchanged and gets no new notification, the
  same as a same-status update today.
- Errors:
  - `400 VALIDATION_ERROR`: a malformed ID or body.
  - `401`: no session.
  - `403`: the caller is not a technician.
  - `404 NOT_FOUND`: the ticket is missing or the caller cannot see it, the reply is missing, or
    the reply belongs to a different ticket.
  - `400 NOT_A_SOLUTION`: the reply is a `COMMENT`.
  - `400 INVALID_STATUS_TRANSITION`: `markResolved` is set and the ticket is neither
    `IN_PROGRESS` nor `RESOLVED`. Nothing is written in this case.
  - `500`: an unexpected error, returned as the stable error object.

### Withdraw (technician)

`DELETE /api/tickets/:ticketId/replies/:replyId/endorsement` removes the caller's own endorsement
and returns `204`. It returns `404` when the caller has no endorsement on that reply. Its other
errors match the `PUT` route. Withdrawing never changes the ticket's status.

Endorsing and withdrawing do not change the reply or the ticket's `updatedAt`, except through
`markResolved`.

## Pages

On `/tickets/:id`, the "Replies" section becomes two parts:

1. **Suggested solutions**. Endorsed solutions come first, ordered by number of endorsements
   (most first) and then oldest first. Unendorsed solutions follow, oldest first. Each endorsed
   solution has a visible "Endorsed by IT" badge and lists each endorsement with the technician's
   name, the time, and the notes. Text is rendered through React and is never treated as HTML.
2. **Discussion**. Comments are listed oldest first, as replies are today.

The post form gains a required radio group, "Suggest a solution" or "Add a comment", with no
default selected. The new post appears in the matching section.

Technicians see an **Endorse** button on each solution they have not endorsed. It opens an inline
form with an optional "Notes for this endorsement" textarea (2,000 characters) and, only when the
ticket is `IN_PROGRESS`, a "Also mark this ticket resolved" checkbox. On a solution they have
already endorsed, technicians see **Edit notes** and **Withdraw** instead. Withdraw asks for
confirmation. Each action shows a pending state, prevents duplicate submissions, announces
success, and keeps the draft and shows an error if it fails. If the ticket's status changes,
`TicketDetail` shows the new status without a reload.

Users who are not technicians never see endorsement controls.

## Tech Stack and Structure

The tech stack is unchanged. The changes are:

- **Schema:** a new `reply_kind` enum and a `ticket_replies.kind` column (`NOT NULL DEFAULT
'COMMENT'`). A new `reply_endorsements` table with these columns: `id`; `reply_id`, which
  references `ticket_replies` and cascades on delete; `technician_id`, which references `users`
  and cascades on delete; `notes text NULL`; `created_at`; and `updated_at`. The table has
  `UNIQUE (reply_id, technician_id)` and an index on `reply_id`. Both changes ship in one additive
  Drizzle migration.
- **API:** the contract additions go in `apps/api/src/tickets/ticket-contract.ts`. The routes go in
  `ticket-route.ts`, beside the reply routes. The repository methods `endorseReply`,
  `withdrawEndorsement`, and the endorsements loaded by `listRecentReplies` go in
  `postgres-ticket-repository.ts`. Status changes reuse the logic inside `updateStatus`, refactored
  into a helper that runs inside a transaction.
- **Web:** `ticket-api.ts` gets `endorseReply` and `withdrawEndorsement`. `TicketReplies.tsx` is
  split into solution and comment sections, with a new `SolutionEndorsement` component for the
  technician controls. `TicketDetail` passes the viewer's technician flag, the ticket status, and
  a status-change callback.
- **Example data:** `db:example` gains a few solutions, one with two endorsements.

## Testing Strategy

- **Contract and route tests:** the default kind; validation of kind, notes, and markResolved; the
  401/403/404/400 cases with no write; `NOT_A_SOLUTION`; replacing your own endorsement; withdraw
  returning 204 or 404; `isOwn` being correct for each viewer; and no user IDs in responses.
- **PostgreSQL integration tests:** the migration default for existing replies; one endorsement per
  technician per reply; endorsements cascading with a reply, ticket, or user; markResolved writing
  the endorsement, status, and notification atomically, with a rollback on an invalid transition;
  replies and endorsements for another ticket being rejected; and visibility applying to the
  endorsement routes.
- **Component tests:** grouping and ordering; the badge and notes; the kind radio being required;
  technician-only controls; the resolve checkbox appearing only when the ticket is `IN_PROGRESS`;
  endorse, edit, and withdraw, each with pending, success, and error states; and the
  status-change callback.
- Coverage thresholds stay as they are.

## Boundaries

- Always: take the technician's identity from the session, check that the reply belongs to the
  ticket in the URL, apply ticket visibility before revealing that a reply exists, and render notes
  through React.
- Ask first: notifications for endorsements, letting ticket owners accept solutions, voting by
  regular users, editing or deleting replies, changing a reply's kind, and letting a technician
  remove someone else's endorsement.
- Never: expose user IDs or usernames in endorsements, let endorsement skip status stages, or
  trust a client-sent role or technician ID.

## Success Criteria

- Visitors can post solutions or comments, and both persist across reloads in the right section.
- A technician can endorse a solution with or without notes, edit the notes, and withdraw it. Other
  users never see those controls, and the API rejects their requests.
- Endorsed solutions are shown first with the technician's name and notes.
- Endorsing with "mark resolved" on an `IN_PROGRESS` ticket resolves it and notifies the owner in
  one transaction. Invalid transitions write nothing.
- Existing replies appear as comments after migration.
- Formatting, linting, type checking, migrations, tests, coverage, build, and smoke checks pass.

## Open Questions

- Should the ticket owner, not just IT, be able to mark a solution as "worked for me"?
- Should the ticket owner be notified when a solution on their ticket is endorsed?
- Should comments become solutions later (for example, a technician promoting a comment)?
