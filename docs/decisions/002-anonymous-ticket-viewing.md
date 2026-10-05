# ADR-002: Allow Anonymous Ticket Viewing for the Baseline

## Status

Accepted

## Date

2026-10-05

## Context

ADR-001 limited the anonymous exception to ticket creation and deferred reading until authentication and authorization are designed. The product owner has since requested a page listing all submitted tickets as the default homepage, explicitly as a non-logged-in view for now. Accounts, ownership, and roles are still undecided.

## Decision

Allow unauthenticated `GET /api/tickets` and `GET /api/tickets/:id` requests, make the ticket list the homepage, and give each ticket its own page. This amends ADR-001 for reading only; updating, assignment, and deletion remain out of scope. The list exposes every stored ticket field because no ownership model exists to scope visibility. The list endpoint returns at most the 100 most recently created tickets; any ticket can be read by ID.

## Alternatives Considered

### Wait for authentication

Rejected because the product owner wants a usable viewer before the account model exists.

### Expose only titles and statuses publicly

Rejected for this slice because the viewer would not show what was submitted. It remains the likely shape of a public view once technicians can sign in.

### Paginate the list

Deferred. A fixed cap bounds the response without committing to a pagination contract before filtering and sorting requirements are known.

## Consequences

- Anything a visitor submits is publicly readable; the UI states this beside the existing warning about sensitive information.
- Public deployment needs the abuse controls from ADR-001 and a visibility review before launch.
- Tickets older than the 100 most recent are not listed until pagination is designed, but remain reachable by their URL.
- Ticket URLs contain the full UUID, so a ticket page can be shared by link.
- A future authentication ADR must define which fields stay public and who can see the rest.
