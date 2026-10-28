# Implementation Plan: Notification Settings

## Overview

Implement `docs/specs/notification-settings.md` and ADR-011. Add a session-scoped settings API
that stores an email address and email preferences, and a `/settings` page linked from the
account menu. No email is sent in this slice.

## Architecture Decisions

- Keep the route-to-repository structure used by `auth`, `tickets`, and `notifications`, with a
  new `settings` module.
- Use one `notification_settings` row per user, written with `INSERT ... ON CONFLICT (user_id)
DO UPDATE`. A missing row means default settings.
- Fastify's Ajv schema validates fields. The route checks that `emailEnabled` has an email and at
  least one status.
- The web page follows the `TicketForm` patterns for fields, inline errors, and submit state.

## Task List

### Phase 1: Persistence

- [x] Add the `notificationSettings` table and generate its migration.
  - Acceptance: the migration only adds a table, its PK is also a cascading FK to `users`, and
    the defaults match the spec.
  - Verify: inspect the generated SQL and run `pnpm db:migrate`.

### Phase 2: Settings API

- [x] Add the settings contract, repository interface, Postgres repository, and
      `GET`/`PUT /api/settings/notifications`, registered in `app.ts` and `server.ts`.
  - Acceptance: session required; defaults when no row exists; validation, normalization,
    `EMAIL_SETTINGS_INCOMPLETE`, and rate limit as specified; no client-supplied user id.
  - Verify: route tests and PostgreSQL integration tests (round trip, isolation, cascade).

### Phase 3: Settings Page

- [x] Add `settings-api.ts` and `SettingsPage`, add the `/settings` route in `App.tsx`, and turn
      the account-menu Settings item into a link for signed-in users.
  - Acceptance: loading, signed-in form, anonymous sign-in prompt, fieldset disabled while emails
    are off, inline validation, success and error states, accessible labels.
  - Verify: component tests and the App/AccountMenu tests.

### Phase 4: Example Data and Docs

- [x] Give one `db:example` user saved settings, and update README and AGENTS.md.

### Checkpoint: Complete

- [x] Formatting, linting, type checking, migrations, tests, coverage, build, and smoke checks pass.

## Risks and Mitigations

| Risk                                         | Impact | Mitigation                                                       |
| -------------------------------------------- | ------ | ---------------------------------------------------------------- |
| A user reads or changes another user's email | High   | Every query is keyed by the session user id; the body has no id. |
| Email address leaks through other responses  | High   | Only the settings route selects `email`; response schemas strip. |
| Users expect emails before delivery ships    | Medium | The page says delivery is coming soon.                           |
| Unverified address is later emailed          | Medium | Spec and ADR require verification before the first send.         |
