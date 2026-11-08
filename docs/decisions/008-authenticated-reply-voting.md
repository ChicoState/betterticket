# ADR-008: Require Authentication for Reply Voting

## Status

Accepted on 2026-11-08.

## Date

2026-11-08

## Context

The product owner requested upvotes and downvotes for logged-in users while preventing visitors from voting. An unfinished local draft already targets ticket replies. Public anonymous replies remain supported under ADR-004.

## Decision

Add account-scoped voting to replies using existing server-side sessions. Allow USER and TECHNICIAN accounts equally. Store one vote per account/reply with a database constraint and expose aggregate totals publicly. Keep the viewer's own selection private and omit voter identities. Require valid authentication for both setting and removing a vote. Reply creation remains anonymous and public.

## Alternatives Considered

- UI-only disabling: rejected because callers could bypass the page and write directly to the API.
- Anonymous votes keyed by browser storage or IP: rejected because this conflicts with the requested login requirement and does not reliably identify an account.
- Separate aggregate counters as the source of truth: deferred because deriving totals from vote rows avoids drift and supports the current bounded reply list.

## Consequences

A new additive migration is required. Uniqueness prevents repeated requests from adding duplicate votes. Session-aware reads must avoid shared caching. Anonymous reply access and existing ticket workflow decisions remain unchanged.
