# Implementation Plan: Public Registration and Login Gateway

## Completed Work

- [x] Add the public registration contract and route with server-enforced `USER` role, validation,
      duplicate conflict response, and a five-attempt-per-minute rate limit.
- [x] Build an accessible account gateway at `/`; move the anonymous list to `/tickets`; preserve
      `/new` and `/tickets/:id`.
- [x] Add API/component regression tests and update product documentation.

## Verification

- [x] Run the pinned formatting, lint, typecheck, migration, test, coverage, build, and smoke
      commands before merge.
- [ ] Verify the account gateway in a real browser at mobile and desktop widths.
