# Implementation Plan: Ticket Search and Similar Tickets

## Overview

Implement `docs/specs/ticket-search.md` and ADR-015 for issue #84. Add optional search parameters
to the ticket list endpoint, a search form on the ticket list, and a sidebar on the new-ticket form
that shows similar tickets and search results.

## Architecture Decisions

- Keep the route-to-repository structure. The route turns `q` and `match` into a list of terms
  with a pure contract function, and the repository only receives terms.
- Build the search as extra conditions on the existing list query so the visibility filter, sort,
  and limit keep one implementation.
- Rank `match=any` in SQL by summing one boolean-to-integer expression per term.
- Keep the sidebar's data fetching in its own component. `TicketForm` only reports its title.

## Task List

### Phase 1: Contract and API

- [x] Add the query schema, limits, stop words, and `parseTicketSearch` to `ticket-contract.ts`.
  - Acceptance: the term rules in the spec.
  - Verify: contract unit tests.
- [x] Extend `TicketRepository.listRecent` with an optional search and pass `q`, `match`, and
      `limit` through the route.
  - Acceptance: blank `q` is treated as absent; `match=any` with no usable terms returns an empty
    list without calling the repository; validation errors return `400`.
  - Verify: route tests.
- [x] Build the `ILIKE` and `EXISTS` conditions and the ranking in `postgres-ticket-repository.ts`.
  - Acceptance: every searched field and reply bodies match; wildcards are literal; visibility,
    sort, and limit still apply.
  - Verify: PostgreSQL integration tests.

### Checkpoint: API complete

- [x] Type checking, linting, and API tests pass.

### Phase 2: Web

- [x] Let `listTickets` in `ticket-api.ts` send the search options.
- [x] Add the search form, URL handling, result count, and empty state to `TicketList`.
- [x] Add `TicketSuggestions` and connect it to the title in `TicketForm` through `App`.
  - Acceptance: all states in the Pages section of the spec; accessible labels and live regions;
    result links open in a new tab.
  - Verify: component tests.

### Phase 3: Docs

- [x] Update README and AGENTS.md (Status).

### Phase 4: Forgiving matching

- [x] Ignore punctuation in the term and the searched text.
- [x] Add the `pg_trgm` migration and approximate matching for terms of four or more letters, with
      exact matches ranked first.
  - Acceptance: "wifi" finds "Wi-Fi"; "pritner" and "printr" find "printer"; short and numeric
    terms stay exact.
  - Verify: PostgreSQL integration tests and `pnpm db:migrate`.

### Checkpoint: Complete

- [x] Formatting, linting, type checking, migrations, tests, coverage, build, smoke checks, and
      `git diff --check` pass.

## Risks and Mitigations

| Risk                                               | Impact | Mitigation                                                              |
| -------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| Search reveals a restricted ticket through a reply | High   | Visibility filter in the same `WHERE`; route still filters; tested.     |
| SQL injection or wildcard abuse through `q`        | High   | Bound parameters and escaped `LIKE` wildcards; tested with `%` and `_`. |
| Expensive scans from anonymous requests            | Medium | 200-character, 8-term, and 100-result bounds; debounce in the sidebar.  |
| Approximate matching returns unrelated tickets     | Medium | Four-letter minimum, no digits, 0.5 threshold, exact matches first.     |
| Stale sidebar results overwrite newer ones         | Low    | Each lookup ignores its response once a newer one starts.               |
| Following a result link discards the draft         | Low    | Sidebar result links open in a new tab.                                 |
