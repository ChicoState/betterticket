# Spec: Baseline Ticket Viewer

## Objective

Let any visitor see the tickets that have been submitted and open any one of them on its own page. The viewer is the default homepage and needs no account; the ticket form moves to `/new`. See [ADR-002](../decisions/002-anonymous-ticket-viewing.md) for why reading is allowed before authentication exists.

## Contract

`GET /api/tickets` takes no parameters and returns `200` with:

```json
{ "tickets": [] }
```

Each entry has the same shape as the `POST /api/tickets` response: UUID, `title`, `description`, `setup`, `additionalInformation` (string or `null`), `status`, and ISO-8601 `createdAt`/`updatedAt`. Tickets are ordered newest first by creation time and limited to the 100 most recent. Unexpected failures return `500` with the stable error object and no database details.

`GET /api/tickets/:id` returns `200` with a single ticket in that same shape. An ID that is not a UUID returns `400` with the `VALIDATION_ERROR` object and is never sent to the database. A well-formed ID with no ticket returns `404` with:

```json
{ "error": { "code": "NOT_FOUND", "message": "The ticket was not found" } }
```

Single-ticket lookup is not limited to the 100 most recent tickets.

The `500` error message for all ticket routes is now `The ticket request could not be completed`; the `INTERNAL_ERROR` code is unchanged.

## Pages

- `/`: ticket list with loading, empty, error-with-retry, and populated states. Each ticket shows its title as a link to its own page, status, short reference, submission time, and the first lines of its description.
- `/tickets/:id`: one ticket with its title, status, short reference, submission time, description, setup, and additional information when present. It has loading, not-found, and error-with-retry states and a link back to the list. Both `400` and `404` responses show the not-found state.
- `/new`: the existing ticket form. Its confirmation links to the new ticket's page.

Navigation uses plain links and the browser path; no routing dependency is added.

## Tech Stack and Structure

Unchanged from [ticket creation](ticket-creation.md). The read routes, repository methods, and `TicketList` and `TicketDetail` components sit beside their creation counterparts in `apps/api/src/tickets`, `apps/api/src/database`, and `apps/web/src/tickets`.

## Testing Strategy

- API route tests prove the list response shape, the empty list, single-ticket lookup, the `400` and `404` cases, and the stable error.
- PostgreSQL integration tests prove newest-first ordering, the limit, and lookup by ID.
- React component tests prove the loading, populated, empty, not-found, error, and retry states and the `/`, `/tickets/:id`, and `/new` pages.

## Boundaries

- Always: render ticket text through React, keep the response bounded, and keep database errors out of responses.
- Ask first: add authentication, pagination, filtering, or workflow transitions.
- Never: add write access through the viewer or expose fields that are not in the ticket contract.

## Success Criteria

- A visitor opening `/` sees submitted tickets, newest first, without signing in.
- A visitor can open any listed ticket on its own page and share its URL.
- A visitor can reach the ticket form from the homepage and the list from the form.
- Empty, missing, and failed loads are reported accessibly.
- Quality, coverage, build, migration, and smoke checks pass.

## Open Questions

- Which ticket fields remain public once accounts exist.
- Pagination beyond the 100 most recent tickets.
