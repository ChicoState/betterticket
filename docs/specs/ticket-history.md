# Spec: Ticket History

## Objective

Let a signed-in user review tickets submitted from their account and open any ticket's existing
detail page.

## Contract

`GET /api/tickets/history` requires the `betterticket_session` cookie. It returns `200` with:

```json
{ "tickets": [] }
```

The response contains up to 100 tickets created by the authenticated session user, ordered newest
first. Entries use the existing ticket response shape, including title, description, status,
creation time, and last-updated time. Anonymous tickets created by that account remain in the
history, but public attribution stays hidden by the existing ticket response rules.

Without a valid session, the endpoint returns `401` with the standard
`AUTHENTICATION_REQUIRED` error. The server never accepts a user ID from the request to select
history, and tickets created by another account are excluded by the database query.

## Page

Authenticated users can open `/history` from the account menu. The page shows ticket title, short
reference ID, status, and submission date. Ticket titles link to `/tickets/:id`. The page has
accessible loading, empty, error-with-retry, and sign-in-required states.

## Boundaries

- Always: enforce ownership from the authenticated session and bound the response at 100 tickets.
- Never: expose another user's tickets or accept a frontend-supplied owner ID.
- Reuse: the existing ticket detail page and ticket response fields.
