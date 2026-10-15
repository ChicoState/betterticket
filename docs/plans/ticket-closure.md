# Implementation Plan: Owner-Managed Ticket Closure

## Architecture Decisions

- Keep reply closure independent from the five-stage ticket progress status.
- Use a private creator relationship for authorization and return only a capability boolean to the browser.
- Make the reply insert conditional on the ticket being open so UI bypasses and stale clients cannot post after closure.

## Task List

- [x] Add the `ticket_reply_status` migration, ticket contract, and owner-only update route.
- [x] Reject replies to closed tickets at the repository and API boundaries.
- [x] Add reply-status presentation and owner controls to ticket pages.
- [x] Cover API, persistence, and UI behavior with tests.
