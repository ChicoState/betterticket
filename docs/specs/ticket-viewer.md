# Spec: Baseline Ticket Viewer

## Objective

Let any visitor see the tickets that have been submitted. The viewer is the default homepage and needs no account; the ticket form moves to `/new`. See [ADR-002](../decisions/002-anonymous-ticket-viewing.md) for why reading is allowed before authentication exists.

## Contract

`GET /api/tickets` takes no parameters and returns `200` with:

```json
{ "tickets": [] }
```

Each entry has the same shape as the `POST /api/tickets` response: UUID, `title`, `description`, `setup`, `additionalInformation` (string or `null`), `status`, and ISO-8601 `createdAt`/`updatedAt`. Tickets are ordered newest first by creation time and limited to the 100 most recent. Unexpected failures return `500` with the stable error object and no database details.

The `500` error message for all ticket routes is now `The ticket request could not be completed`; the `INTERNAL_ERROR` code is unchanged.

## Pages

- `/`: ticket list with loading, empty, error-with-retry, and populated states. Each ticket shows its title, status, short reference, submission time, and description, with setup and additional information in a disclosure.
- `/new`: the existing ticket form.

Navigation uses plain links and the browser path; no routing dependency is added.

## Tech Stack and Structure

Unchanged from [ticket creation](ticket-creation.md). The list route, repository method, and `TicketList` component sit beside their creation counterparts in `apps/api/src/tickets`, `apps/api/src/database`, and `apps/web/src/tickets`.

## Testing Strategy

- API route tests prove the list response shape, the empty list, and the stable error.
- A PostgreSQL integration test proves newest-first ordering and the limit.
- React component tests prove the loading, populated, empty, error, and retry states and the `/` and `/new` pages.

## Boundaries

- Always: render ticket text through React, keep the response bounded, and keep database errors out of responses.
- Ask first: add authentication, pagination, filtering, a single-ticket page, or workflow transitions.
- Never: add write access through the viewer or expose fields that are not in the ticket contract.

## Success Criteria

- A visitor opening `/` sees submitted tickets, newest first, without signing in.
- A visitor can reach the ticket form from the homepage and the list from the form.
- Empty and failed loads are reported accessibly.
- Quality, coverage, build, migration, and smoke checks pass.

## Open Questions

- Which ticket fields remain public once accounts exist.
- Pagination beyond the 100 most recent tickets.
