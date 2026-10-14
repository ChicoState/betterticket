# Implementation Plan: Ticket Creator Attribution

## Architecture Decisions

- Store the creator relationship separately from public display state so anonymous posts can remain privately attributable.
- Derive creators from server-side sessions and return only a nullable display name in public ticket responses.

## Task List

- [x] Add creator persistence, migration, contracts, and repository joins.
  - Acceptance: authenticated creator identity is not browser-controlled and anonymous state remains private.
- [x] Add creation control and creator labels to the ticket UI.
  - Acceptance: signed-in users can opt into anonymous posting; list and detail views show a creator label.
- [x] Cover the API, database, and UI behavior with tests and run project quality gates.
