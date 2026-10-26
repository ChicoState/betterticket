# ADR-009: Store and Sort Ticket Priority in PostgreSQL

## Status

Accepted

## Date

2026-10-26

## Context

Issue #51 requires ticket creators to choose a priority and ticket lists to
sort by priority before applying the existing list limit. Priority must survive
API and database round trips while remaining compatible with existing tickets.

## Decision

Store priority as a PostgreSQL enum with values `LOW`, `MEDIUM`, and `HIGH`.
The column is non-null with a database default of `MEDIUM`, so existing rows
and inserts that omit the field receive the normal priority. The repository
uses an explicit `CASE` ordering for priority lists (`HIGH`, `MEDIUM`, `LOW`),
then descending creation time and UUID as a deterministic tie-breaker. The
default list query retains newest-first ordering.

Priority is creation-only for this issue; no update endpoint or workflow
automation is introduced.

## Alternatives Considered

### Numeric priority column

Rejected because the named enum values are part of the API contract and a
PostgreSQL enum gives invalid stored values stronger protection.

### Frontend-only sorting

Rejected because it sorts only the already-limited response and can omit high
priority tickets. The database must order before `LIMIT`.

### Reuse PostgreSQL enum declaration order

Rejected because enum declaration order would make the desired ordering
implicit and harder to audit. The repository expresses the ordering explicitly.

## Consequences

- Existing data migrates safely to `MEDIUM`.
- API clients receive a required priority on every ticket response.
- The list query has a small explicit ordering expression and remains bounded by
  the existing limit.
- If PR #57 adds a migration with the same numeric prefix, the two migrations
  must be resequenced together without rewriting an applied migration.
