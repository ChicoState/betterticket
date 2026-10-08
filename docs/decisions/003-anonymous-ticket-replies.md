# ADR-003: Allow Anonymous Ticket Replies for the Baseline

## Status

Accepted

## Date

2026-10-07

## Context

ADR-001 and ADR-002 allow anonymous ticket creation and reading and leave every other operation out of scope until authentication and authorization are designed. The product owner has since requested that users and technicians be able to reply to tickets. Accounts, sessions, and roles still do not exist, so the API cannot tell a ticket's submitter from a technician or from any other visitor.

## Decision

Allow unauthenticated `GET /api/tickets/:id/replies` and `POST /api/tickets/:id/replies` requests and show the conversation with a reply form on each ticket page. A reply stores only its text, its ticket, and a creation time: no author, role, or display name. Replies cannot be edited or deleted. This amends ADR-001 and ADR-002 for adding replies only; changing a ticket's own fields, status, assignment, and deletion remain out of scope.

## Alternatives Considered

### Let the author choose "User" or "Technician"

Rejected because the label would be unverified: anyone could answer a public ticket as a technician. It would also store a role that the future account model would have to migrate or distrust, the same debt ADR-001 avoided by rejecting a synthetic owner.

### Build authentication first

Rejected for this slice because it turns replies into an account, session, and role project before those requirements exist. It remains the route to verified user and technician replies.

### Ask for an optional display name

Rejected because it is unverified contact-like data on a public page and invites impersonation without adding trust.

## Consequences

- Submitters and technicians can hold a conversation on a ticket today, but readers cannot tell who wrote a reply or whether it is authoritative; the UI says replies are anonymous.
- Anyone can post to any ticket. Public deployment needs the abuse controls from ADR-001 (rate limiting at minimum) and a moderation path, since replies cannot be removed through the application.
- A future authentication ADR must define reply authorship and roles and how existing anonymous replies are shown beside attributed ones.
- Reply text is public, like the ticket it belongs to.
