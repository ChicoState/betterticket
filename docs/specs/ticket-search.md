# Spec: Ticket Search and Similar Tickets

> Status: **Approved** 2026-11-16 (ADR-015 accepted). Implements issue #84.

## Objective

Let people find an existing ticket, and the solutions on it, before they file a new one.

User stories:

- As a visitor, I can search the ticket list by words that appear in a ticket or in its replies, so
  I can find a fix that someone already suggested.
- As a visitor writing a new ticket, a sidebar shows tickets similar to the title I am typing, so I
  notice an existing ticket before I submit a duplicate.
- As a visitor writing a new ticket, I can also search from that sidebar without leaving the form
  or losing my draft.

## Assumptions

1. Search covers the ticket's `title`, `description`, `setup`, and `additionalInformation`, and the
   `body` of its replies (suggested solutions and comments). Endorsement notes and creator names
   are not searched.
2. Search never widens access. It returns only tickets the viewer could already see in the list
   under ADR-008, and a reply can only match on behalf of such a ticket.
3. Matching is case-insensitive substring matching that ignores punctuation and tolerates small
   misspellings through PostgreSQL's `pg_trgm` extension (ADR-015). There is no stemming or
   synonym matching.
4. Search is available to anonymous visitors, as the ticket list is.
5. The response shape of `GET /api/tickets` does not change. Results do not say which field or
   reply matched.

## Contract

`GET /api/tickets` gains three optional query parameters. Requests without them behave exactly as
before.

| Parameter | Values                         | Meaning                                                 |
| --------- | ------------------------------ | ------------------------------------------------------- |
| `q`       | string, at most 200 characters | The search text. Blank or whitespace-only means absent. |
| `match`   | `all` (default) or `any`       | How the words of `q` combine. Ignored without `q`.      |
| `limit`   | integer 1–100, default 100     | The largest number of tickets to return.                |

### Search terms

`q` is split on whitespace into terms. Terms are compared case-insensitively, duplicates are
dropped, and only the first 8 distinct terms are used. A term matches a ticket when it is a
substring of any searched field of the ticket or of any of its replies.

Punctuation is ignored in both the term and the searched text: everything except letters, digits,
and whitespace is removed before comparing, so "wifi" finds "Wi-Fi" and "email" finds "e-mail". A
term made only of punctuation is compared literally instead, with `%`, `_`, and `\` treated as
ordinary characters.

A term of four or more letters (and no digits) also matches approximately, when a word in the text
is similar to it (a `pg_trgm` word similarity of at least 0.5) or is the term with two neighbouring
letters swapped. So "pritner" and "printr" find "printer". Shorter terms and terms with digits,
such as room or version numbers, match exactly only.

### `match=all` (search)

Every term must match the ticket. Different terms may match in different fields or replies.
Tickets that contain every term exactly come before tickets matched through a misspelling; within
each group, results are ordered by `sort` (`votes`, `newest`, or `priority`) as the unfiltered list is.

### `match=any` (similar tickets)

Terms shorter than 3 characters and common English stop words (for example "the", "not", "with")
are dropped first. A ticket is returned when at least one remaining term matches. Results are
ordered by the number of distinct terms matched, most first, then newest first; `sort` is ignored.
An approximate match counts as half a term.
If no terms remain, the response is `{ "tickets": [] }` and the database is not queried.

### Errors

- `400 VALIDATION_ERROR`: `q` longer than 200 characters, an unknown `match`, or a `limit` that is
  not an integer from 1 to 100.
- `500`: an unexpected error, returned as the stable error object.

Unknown query parameters are still ignored.

## Pages

### Ticket list (`/tickets`)

- A search form (`role="search"`) sits above the list with a labelled "Search tickets" input.
  The list updates with `match=all` as the visitor types, after a short pause; submitting the form
  searches at once. The current tickets stay on screen until the results arrive. The sort control
  keeps working and applies to the results.
- The applied query is kept in the page URL as `?q=…` (replacing the history entry), and a page
  opened with `?q=…` starts with that search applied.
- While a search is applied, a status line reads "N tickets match “query”" and a **Clear search**
  button returns to the full list.
- When nothing matches, the page says so and links to the new-ticket form.

### New ticket (`/new`)

A sidebar titled "Already solved?" sits to the right of the form (above it on narrow screens). It contains:

- A labelled "Search existing tickets" input. Results update as the visitor types, after a short
  pause.
- A results area that shows up to 5 tickets:
  - **Search results** (`match=all`) when the search input has text, with a link to see all
    results on the ticket list.
  - Otherwise **Similar tickets** (`match=any`), based on the title being typed in the form.
  - Otherwise nothing, until the visitor types a title or a search.
- Each result shows the ticket title as a link, its status, and a short excerpt. Result links open
  in a new tab so the draft is not lost, and say so to assistive technology.
- Loading, empty, and error states are shown in the sidebar and announced politely. A failed
  lookup never blocks or disables the form.

All ticket text is rendered through React and is never treated as HTML.

## Tech Stack and Structure

The tech stack is unchanged. One additive migration enables the `pg_trgm` extension, which ships
with the PostgreSQL image; no table changes.

- **API:** `ticket-contract.ts` gets the query schema additions, the limits, and a pure
  `parseTicketSearch(q, match)` function that produces the terms. `ticket-route.ts` passes the
  search and limit to the repository. `TicketRepository.listRecent` takes an optional search.
  `postgres-ticket-repository.ts` builds the `ILIKE` conditions, including an `EXISTS` on
  `ticket_replies`, in the same `WHERE` as the visibility filter.
- **Web:** `ticket-api.ts` `listTickets` accepts search options. `TicketList.tsx` gets the search
  form. A new `TicketSuggestions.tsx` renders the sidebar. `TicketForm` reports title changes
  through an `onTitleChange` prop, and `App.tsx` connects the two.

## Testing Strategy

- **Contract tests:** term splitting, case folding, de-duplication, the 8-term cap, and the
  short-word and stop-word rules for `match=any`.
- **Route tests:** the search and limit reach the repository; blank `q` is treated as absent;
  validation errors; `match=any` with no usable terms returns an empty list without a query; the
  viewer is still passed; and results are still filtered by `canAccessTicket`.
- **PostgreSQL integration tests:** matching in each ticket field and in reply bodies; all-terms
  versus any-term behaviour; ranking by matched terms; literal `%`, `_`, and `\`; visibility for
  anonymous viewers, owners, and technicians (including a match that exists only in a reply on a
  private ticket); punctuation variants; misspellings, swapped letters, and exact-before-approximate
  ordering; short and numeric terms staying exact; sort and limit applied after filtering.
- **Component tests:** the list search form, URL handling, result count, clear, and empty state;
  the sidebar's hint, similar, search, loading, empty, and error states, the debounce, and the
  new-tab links; and `TicketForm` reporting its title.
- Coverage thresholds stay as they are.

## Boundaries

- Always: apply the viewer's visibility filter in the same query as the search, bind search text
  as parameters, escape `LIKE` wildcards, and bound the query length, term count, and result count.
- Ask first: an index or table change for search, full-text search, a looser similarity threshold,
  searching
  endorsement notes, returning match snippets or highlights, filters by status or priority, and
  a rate limit on the list route.
- Never: return a ticket the viewer cannot access, reveal through search that a restricted ticket
  exists, or build SQL by concatenating search text.

## Success Criteria

- Searching the list for a word that appears only in a reply returns that ticket.
- A multi-word search returns only tickets that contain every word.
- Searching "wifi" finds a "Wi-Fi" ticket, and "pritner" finds a "printer" ticket.
- Typing a title on the new-ticket form shows similar tickets without submitting anything, and the
  sidebar search shows results without navigating away.
- Anonymous visitors, regular users, and technicians each see only results they could already see
  in the list.
- Formatting, linting, type checking, migrations, tests, coverage, build, and smoke checks pass.

## Open Questions

- Should results show which reply matched, or flag tickets that have an IT-endorsed solution?
- Should similar-ticket lookup also use the description, not just the title?
- If the ticket count grows well past the list limit, should search get trigram (GIN) indexes or
  move to PostgreSQL full-text search (see ADR-015)?
