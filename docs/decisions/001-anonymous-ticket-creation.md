# ADR-001: Allow Anonymous Ticket Creation for the Baseline

## Status

Accepted

## Date

2026-09-28

## Context

The approved infrastructure plan requires accounts and authentication before general product development. Issue #30 needs the smallest usable ticket-creation path, and the product owner explicitly approved anonymous creation for this baseline. The account, session, ownership, and authorization models are still intentionally undecided.

## Decision

Allow unauthenticated `POST /api/tickets` requests for issue #30. Tickets will not contain a placeholder owner. This exception applies only to creation; reading, updating, assignment, and deletion are out of scope until authentication and authorization are designed.

## Alternatives Considered

### Build authentication first

Rejected for this slice because it expands issue #30 into an account and session project before the product requirements exist.

### Add a nullable or synthetic owner

Rejected because it would encode an unapproved ownership model and create migration debt.

## Consequences

- The initial workflow is usable without an account.
- Public deployment needs abuse controls such as rate limiting before launch.
- A future authentication ADR must define ownership and the migration strategy for anonymous tickets.
