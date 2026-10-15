# ADR-006: Use Private Ticket Ownership for Reply Closure

## Status

Accepted

## Date

2026-10-14

## Context

Tickets already have public progress statuses and may be displayed anonymously, while authenticated submissions retain a private creator relationship. Ticket owners need to stop new replies without exposing that relationship.

## Decision

- Add an independent `OPEN`/`CLOSED` reply status; preserve the existing progress status lifecycle.
- Only the authenticated private creator may change reply status, including when their ticket displays as anonymous.
- Anonymous visitors and non-owners cannot change reply status. Technician management of non-owned tickets remains deferred.
- Enforce closure in the reply write query and expose only a derived browser capability, never a creator ID.

## Consequences

- Closed tickets remain publicly readable but reject new replies with a stable conflict response.
- Existing and future tickets default to open for replies.
- Future staff controls require a separate authorization decision.
