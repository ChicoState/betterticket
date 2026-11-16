# ADR-015: Search Tickets With Bounded Substring and Trigram Matching

## Status

Accepted

## Date

2026-11-16

## Context

Issue #84 asks for ticket search so people can find a solution before filing a ticket. Suggested
solutions live in reply bodies (ADR-010), so a useful search has to look at replies as well as the
ticket's own fields. Tickets carry a stored visibility (ADR-008), and the list endpoint already
filters by it. The product owner also wants the new-ticket form to show similar tickets while the
title is typed.

## Decision

- Add search to the existing `GET /api/tickets` endpoint through optional `q`, `match`, and `limit`
  query parameters instead of adding a new endpoint. The response shape is unchanged.
- Match with case-insensitive substring comparison (`ILIKE`) over the ticket's text fields and,
  through `EXISTS`, the bodies of its replies. Search text is bound as parameters and `LIKE`
  wildcards are escaped. Punctuation is removed from both the term and the searched text before
  comparing, so spelling variants such as "wifi" and "Wi-Fi" match each other.
- Support two modes over the same terms: `all` for search (every term must match) and `any` for
  similar tickets (at least one term, ranked by how many matched, after dropping short words and
  stop words).
- Apply the ADR-008 visibility filter in the same `WHERE` clause as the search, so a reply can only
  match on behalf of a ticket the viewer may see.
- Bound the work: at most 200 characters of query, 8 terms, and 100 results.
- Tolerate misspellings for terms of four or more letters: a term also matches a word with a
  `pg_trgm` word similarity of at least 0.5, or the term with two neighbouring letters swapped.
  Shorter terms and terms with digits match exactly only. Exact matches rank ahead of approximate
  ones.
- Enable `pg_trgm` in one additive migration (`CREATE EXTENSION IF NOT EXISTS`). It ships with the
  PostgreSQL image and is a trusted extension, so the database owner can enable it. No tables
  change and no index is added.

## Alternatives Considered

### PostgreSQL full-text search with a `tsvector` column and GIN index

Rejected for now. It scales better and stems words, but it needs a way to keep reply text in the
index, its word-based matching does not find partial words such as "print" in "printer", and it
does not tolerate misspellings. At the current data size a sequential scan is acceptable.

### Trigram (GIN) indexes

Deferred. The `pg_trgm` extension is enabled for similarity matching, but its indexes are not
added yet: the comparison runs over punctuation-stripped text, so they would have to be expression
indexes on every searched column, for tables that are still small.

### Exact substring matching only

This was the first version. It was replaced after testing showed that ordinary variants ("wifi"
for "Wi-Fi") and misspellings found nothing, which defeats the goal of finding an existing ticket.

### A separate `/api/tickets/search` endpoint

Rejected because search results are the ticket list with a filter. A second endpoint would have to
repeat the visibility, sorting, and response-shape rules and keep them in step.

### Filter on the client

Rejected because the client only has the 100 most recent tickets and does not have reply bodies.

## Consequences

- Search works for anonymous visitors and adds a read path whose cost grows with the number of
  tickets and replies. The bounds above cap each request. The list route still has no per-route
  rate limit, unlike the sign-in and settings routes; adding one is a follow-up decision.
- Approximate matching brings some loosely related results, for example "access" finding
  "success". They rank below exact matches, and the threshold is one constant to tune.
- There is no stemming or synonym matching.
- The database now needs the `pg_trgm` extension, so a deployment target must allow it.
- The repository's `listRecent` takes an optional search, so the route, the fake repository in
  tests, and the PostgreSQL implementation stay one code path for listing.
- Adding indexes or moving to full-text search later would change only the repository's condition
  builder and add a migration. The API contract can stay the same.
