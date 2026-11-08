# ADR-009: Extend Authenticated Voting to Tickets

## Status

Accepted on 2026-11-08 following the product owner's explicit request.

## Context

ADR-008 added account-scoped reply voting. Users also need to upvote and downvote the request itself and want thumbs-up/down icons for all votes.

## Decision

Add independent account-scoped ticket votes under `/api/tickets/:ticketId/vote`, using the same session authorization and one-vote rule as replies. Keep vote state in a dedicated `ticket_votes` table and expose it through a separate state endpoint to preserve existing ticket response contracts. Show voting on the ticket detail page and share the interaction UI and inline SVG thumb icons with reply voting.

## Alternatives and Consequences

A polymorphic votes table was rejected because dedicated foreign keys preserve referential integrity. Extending every ticket response was deferred because a bounded detail-state endpoint supplies the requested behavior without changing unrelated ticket contracts or queue ordering. Both kinds of votes require login and retain public aggregate counts; vote identities stay private. An additive migration is required, and voting leaves ticket status and timestamps unchanged.

## Extension: Ticket List Voting

On 2026-11-08 the product owner requested controls directly in the Tickets list. Extend the list response with a `votes` object per ticket, populated in a single bounded batch query. This supersedes the earlier deferral of vote fields for the list only; detail/status/assignment response contracts stay unchanged. Session-aware lists use private no-store caching and expose only the viewer's selection. Shared thumb controls on each card use the existing mutation endpoints without navigation.
