# Spec: Notification Settings

> Status: **Approved** 2026-10-26 (ADR-009 accepted).

## Objective

Prepare for emailing ticket owners when a technician changes a ticket's status (follow-up to
ADR-008). This slice adds a signed-in **Settings** page where a user saves an email address and
chooses whether, and for which status changes, they want emails. It stores preferences only. No
email is sent until the delivery slice ships.

## Assumptions

1. Settings are per account and need a session. Anonymous visitors who open `/settings` are
   asked to sign in.
2. Email is opt-in. Users have no email address until they add one, and emails stay off until
   they turn them on.
3. "When to receive emails" means which status changes send one. Users can pick any of
   `UNDER_REVIEW`, `IN_PROGRESS`, and `RESOLVED`. `COMPLETED` is added when the issue #8 slice
   ships. Daily digests are deferred.
4. In-app notifications (ADR-008) stay on for everyone. These settings control email only.
5. The address is saved unverified. The delivery slice must verify it before sending anything.
6. Addresses do not need to be unique across accounts, and they never replace the username for
   sign-in.

## Contract

### `GET /api/settings/notifications`

- Requires a session (`401 AUTHENTICATION_REQUIRED` otherwise). Returns the caller's settings:

```json
{ "email": "user@example.com" | null, "emailEnabled": false, "emailStatuses": ["RESOLVED"] }
```

- A user with no saved settings gets the defaults:
  `{ "email": null, "emailEnabled": false, "emailStatuses": ["RESOLVED"] }`.

### `PUT /api/settings/notifications`

- Requires a session. Accepts the same object as the response, replaces the caller's settings,
  and returns the saved settings with status `200`.
- Validation (`400 VALIDATION_ERROR`):
  - The request rejects unknown fields.
  - `email` is `null` or a string of at most 254 characters shaped like `local@domain.tld`.
    Surrounding whitespace is allowed. The server trims it, stores it lowercase, and stores a
    blank value as `null`.
  - `emailStatuses` contains unique values from `UNDER_REVIEW`, `IN_PROGRESS`, and `RESOLVED`.
  - `emailEnabled: true` needs a non-null `email` and at least one status
    (`400 EMAIL_SETTINGS_INCOMPLETE`).
- The user is always taken from the session. The request has no `userId`.
- Rate limit: 20 updates per minute per session.

### Persistence

New `notification_settings` table (one row per user, created on first save):

| Column           | Type              | Notes                          |
| ---------------- | ----------------- | ------------------------------ |
| `user_id`        | uuid PK, FK users | `on delete cascade`            |
| `email`          | varchar(254)      | nullable                       |
| `email_enabled`  | boolean           | default `false`                |
| `email_statuses` | `ticket_status[]` | default `{RESOLVED}`, not null |
| `updated_at`     | timestamptz       | default now                    |

Drizzle generates the migration, which only adds the table. Emails are never included in ticket,
reply, notification, or session responses.

### UI

- The disabled "Settings (coming soon)" item in `AccountMenu` becomes a link to `/settings` for
  signed-in users. Anonymous visitors do not see it.
- `/settings` shows a "Notifications" form with:
  - an **Email address** input (`type="email"`, `autocomplete="email"`).
  - an **Email me about ticket status changes** checkbox.
  - a "Send an email when a ticket moves to" fieldset with Under review, In progress, and Resolved
    checkboxes. The fieldset is disabled while emails are off, but its values are kept.
  - a **Save** button, and inline success, validation, and error messages (`role="status"` and
    `role="alert"`).
- A note says email delivery is coming soon and that in-app notifications stay on.
- The page shows a loading state, and a sign-in prompt for anonymous visitors.

## Tech Stack and Structure

- `apps/api/src/database/schema.ts`: `notificationSettings` table, plus its migration in
  `apps/api/drizzle`.
- `apps/api/src/settings`: `settings-contract.ts`, `settings-repository.ts`, `settings-route.ts`
  (+ tests). `PostgresSettingsRepository` goes in `apps/api/src/database`.
- `apps/api/src/app.ts` and `server.ts`: register the routes and repository.
- `apps/web/src/settings`: `settings-api.ts` and `SettingsPage.tsx` (+ tests). `App.tsx` adds the
  `/settings` route and `AccountMenu.tsx` enables the link.
- `db:example`: gives one example user saved settings.

## Commands

```sh
docker compose --profile tools run --rm toolchain pnpm db:generate
docker compose --profile tools run --rm toolchain pnpm db:migrate
docker compose --profile tools run --rm toolchain pnpm format:check
docker compose --profile tools run --rm toolchain pnpm lint
docker compose --profile tools run --rm toolchain pnpm typecheck
docker compose --profile tools run --rm toolchain pnpm test
docker compose --profile tools run --rm toolchain pnpm coverage
docker compose --profile tools run --rm toolchain pnpm build
bash scripts/smoke.sh
```

## Testing Strategy

- Contract and route tests:
  - `401` without a session.
  - Defaults when no row exists.
  - Validation: unknown fields, a `userId` injection attempt, a bad email, a duplicate or
    disallowed status, and an incomplete enable.
  - Trimming and lowercasing the email.
  - The rate limit.
- PostgreSQL integration tests: upsert round trip, isolation between users, and cascade when a
  user is deleted.
- Component tests:
  - Loading, then a form filled from the server.
  - The fieldset is disabled while emails are off.
  - Enabling without an email shows client-side feedback.
  - Successful save and server error states.
  - The anonymous sign-in prompt.
  - The AccountMenu link appears only for signed-in users.

## Boundaries

- Always: take the user from the session, validate at the HTTP boundary, keep emails private to
  their owner, and keep schema changes versioned.
- Ask first: sending email (the provider, SMTP config, and the outbox/queue design are the next
  slice), email verification flows, digests, and per-ticket muting.
- Never: accept a client-supplied user id, expose a user's email to other users or technicians,
  log email addresses, or send email to an unverified address.

## Success Criteria

- A signed-in user can open Settings from the account menu, save an email and their email
  preferences, reload, and see the same values.
- Invalid or incomplete settings are rejected with clear inline messages.
- No other user can read or change those settings.
- All quality, migration, coverage, build, and smoke checks pass.

## Deferred to the Email Delivery Slice

- An email provider or SMTP adapter, configured through environment variables, with a local mail
  catcher in Compose.
- Email verification before the first send.
- A transactional outbox written with the status change and notification (ADR-008), drained by a
  worker, so a failed send never rolls back a status change.
- An unsubscribe link in every email.
