# Implementation Plan: Authenticated Reply Voting

## Status

Approved on 2026-11-08 alongside [the spec](../specs/reply-voting.md). Work sequentially and preserve existing uncommitted changes.

## Task 1: Complete the persistence contract

- Files: `ticket-repository.ts`, `schema.ts`, and generated migration metadata/SQL.
- Acceptance: repair the unfinished reply interface; define vote state and mutation results; enforce one valid vote per account/reply with cascading foreign keys.
- Verify: generate and inspect the migration; apply it to an isolated test database; run type checking for the contract.
- Dependencies: spec and plan approval.

## Task 2: Persist and query votes

- Files: `postgres-ticket-repository.ts` and its integration test.
- Acceptance: upsert/switch/remove the authenticated user's vote; scope writes to the correct ticket; list public totals plus the caller's own selection without voter identities.
- Verify: write failing integration tests first, then prove persistence, idempotency, user isolation, missing replies, concurrent writes, totals, and reload state.
- Dependencies: Task 1.

## Task 3: Protect the vote API

- Files: `ticket-contract.ts`, `ticket-route.ts`, `ticket-route.test.ts`, and repository test doubles used by auth tests.
- Acceptance: authenticated PUT/DELETE work for both roles; visitor and invalid-session requests never call vote mutations; invalid values and cross-ticket IDs fail; personalized reads cannot be shared-cached.
- Verify: failing route tests first, then all API tests and type checking.
- Dependencies: Task 2.

## Checkpoint: Backend

Migration, persistence, authorization, and API tests pass before UI integration.

## Task 4: Complete the voting component

- Files: existing `ticket_voted_solution.tsx`, its component tests, `ticket-api.ts`, and client tests.
- Acceptance: use authoritative server counts; prevent duplicate submissions; show accessible failure and sign-in messages; implement vote, switch, and remove behavior.
- Verify: failing client/component tests first, then targeted frontend tests.
- Dependencies: Task 3.

## Task 5: Connect session state to replies

- Files: `TicketDetail.tsx`, `TicketReplies.tsx`, reply/detail tests, and `styles.css`.
- Acceptance: pass the actual current user; disable visitor controls; reload personalized vote state when identity changes; preserve current reply creation and ordering.
- Verify: authenticated, anonymous, and loading-session component tests; real-browser sign-in/vote/reload/sign-out flow.
- Dependencies: Task 4.

## Task 6: Verify and document

- Files: feature spec/plan/decision, README, and AGENTS status as applicable.
- Acceptance: documented contract matches implementation; no unrelated edits or secrets; required quality gates pass.
- Verify: pinned Docker toolchain format, lint, typecheck, migration, tests, coverage, build, isolated smoke test, browser verification, and `git diff --check`. Record any pre-existing failures separately.
- Dependencies: Task 5.

## Risks and Mitigations

- Existing voting code is incomplete and currently contains a malformed TypeScript interface: repair only the voting draft and preserve unrelated work.
- Concurrent or repeated votes could inflate counts: enforce database uniqueness and use idempotent upserts.
- Sessions may expire after the page loads: authorize each request and show a visible sign-in error when a write returns 401.
- Existing integration tests clear tables: use isolated test services and volumes, preserving persistent development data.

## Completion and Verification

All six tasks completed on 2026-11-08. The additive reply-vote migration (originally `0005_lumpy_chat`, now consolidated into `0010_ticket_and_reply_votes` after merging main) was verified on an isolated PostgreSQL instance and applied successfully to the persistent local development database.

- Locked dependency installation, formatting, lint, typecheck, coverage thresholds, production build, and `git diff --check` passed.
- The coverage run executed all 170 tests: 101 API tests, 68 web tests, and one migration-history test. API line coverage was 93.57%; web line coverage was 91.42%.
- Headless Chromium verified anonymous UI/API rejection, real login, keyboard upvoting, reload persistence, vote switching/removal, logout, and expired-session error handling, with no uncaught browser errors.
- Desktop/mobile screenshots were inspected; layouts passed at widths 320, 768, 1024, and 1440 pixels. Screenshots remain in ignored `test-results/`.
- The infrastructure smoke test used a temporary Compose override removing host port publications so existing local services could remain running. It verified isolated service readiness and `SELECT 1`; its containers and volumes were removed.
- Temporary application/browser containers and the disposable test database were removed. The existing local application, PostgreSQL, object storage, credentials, tickets, and unrelated edits were preserved.

The browser connector was unavailable; browser verification used the existing Playwright package and Chromium in a disposable Docker toolchain container. No browser or runtime dependencies were added to the repository.

## Extension Plan: Ticket Voting and Thumb Icons

Authorized by the product owner's explicit request on 2026-11-08. Preserve the completed reply-voting behavior and all unrelated work.

1. Add failing ticket-vote route tests for authenticated writes, anonymous denial, validation, missing tickets, and public/private reads. Add persistence tests for one vote per account and ticket/reply independence.
2. Add the ticket-vote table, migration, repository methods, and session-protected routes. Verify route tests and isolated PostgreSQL integration tests before UI integration.
3. Extract shared vote controls with SVG thumbs-up/down icons. Add the ticket-state client and component to the ticket detail page, keyed by ticket and viewer identity. Verify loading, visitor controls, saved votes, errors, and existing reply behavior with component tests.
4. Run quality/coverage/build gates, real Chromium checks for ticket and reply voting, and an isolated smoke check. Apply the additive local migration, document outcomes, and remove only temporary test resources.

Each step is sequential. Schema/route work precedes UI integration; browser verification precedes completion. No new dependencies, queue sorting, ticket ownership rules, or reply attribution are included.

### Extension Verification

Completed on 2026-11-08. The ticket-vote migration (originally `0006_nifty_riptide`, now consolidated into `0010_ticket_and_reply_votes`) was tested in isolation and applied to the existing local development database.

- All 197 tests passed under coverage: 122 API tests, 74 web tests, and one migration-history test. Coverage thresholds, formatting, lint, typecheck, and production build passed.
- Chromium verified separate ticket/reply thumb controls, keyboard voting, persistent selections after reload, switching/removal for each target, visitor API/UI denial, logout, and session expiry. No uncaught browser errors occurred.
- Desktop/mobile screenshots were inspected, and layouts passed at 320, 768, 1024, and 1440 pixels. Ignored screenshots are stored as `test-results/ticket-voting-desktop.png` and `test-results/ticket-voting-mobile.png`.
- The infrastructure smoke test passed using isolated services with temporary host-port removal. Temporary test containers and the disposable database were removed; existing local application services and data were preserved.

## Extension Plan: Vote from the Tickets List

Authorized by the product owner's explicit request on 2026-11-08.

1. Add failing API and component tests for list totals, viewer privacy, direct voting, and identity changes.
2. Add a batched repository query and extend the existing list response with `votes`. Verify the session-derived viewer, no-store headers, and bounded query behavior.
3. Pass the current user to the list and render shared thumb controls at the bottom of each card. Verify vote/switch/remove without navigation, visitor restrictions, and existing list/detail behavior.
4. Run quality/coverage/build checks and Chromium list/detail verification against an isolated database. Preserve local data and remove temporary test resources.

No schema migration, search feature, sorting change, or new dependencies are required.

### Ticket List Voting Verification

Completed on 2026-11-08. All 202 tests passed under coverage (124 API, 77 web, one migration-history); formatting, lint, typecheck, build, and `git diff --check` passed. Batched database checks cover requested IDs, unvoted tickets, empty input, and viewer privacy.

Chromium verified visible thumb controls on each ticket card, voting/switching/removal while remaining on `/tickets`, independent cards, reload persistence, list/detail agreement, navigation through the Tickets link, visitor blocking, and no per-card vote-state reads. Detail voting remains below the post content. Layouts passed at 320, 768, 1024, and 1440 pixels with no uncaught browser errors. Screenshots were inspected and saved in ignored `test-results/list-voting-desktop.png` and `test-results/list-voting-mobile.png`.

No migration or dependency change was required. Temporary browser/application containers and the isolated test database were removed; existing local data and services were preserved.
