# ADR-009: Notification Settings and Email Preferences

## Status

Accepted

## Date

2026-10-26

## Context

ADR-008 notifies ticket owners in the app only and lists email delivery as a later decision.
Users now want an email when a ticket's status changes. Accounts have no email address
(ADR-003/004 sign users in by username), and the account menu has had a disabled "Settings"
placeholder since the registration slice.

## Decision

- Add a signed-in `/settings` page with an API at `/api/settings/notifications`. The page stores an
  optional email address, an email on/off switch, and the status changes that should send an
  email.
- Store the settings in a separate `notification_settings` table keyed by `user_id`, not as new
  columns on `users`. Auth and identity stay unchanged, and the defaults apply when a user has no
  row.
- Email is opt-in, and in-app notifications stay on for everyone.
- Ship settings before delivery. Sending email, verifying addresses, and adding an outbox worker
  come in a later ADR. Nothing is sent to an address until it is verified.

## Alternatives Considered

### Add `email` to `users` at registration

Rejected for now. It would change the registration contract and make a field required that
most users do not need. A later slice can still add an email at registration.

### A single frequency setting (off / every change / resolved only)

Rejected. Per-status checkboxes cover these options and let us add `COMPLETED` (issue #8) without
a new value in the enum.

### Send email directly from the status-update transaction

Deferred to the delivery ADR. Network calls inside the transaction would let a mail outage
block or roll back status changes. A transactional outbox is the expected approach.

## Consequences

- PostgreSQL gets a `notification_settings` table that is deleted along with its user.
- Users can save preferences before any email is sent. The UI says that delivery is coming soon.
- The delivery slice must add verification, an unsubscribe link, provider configuration, and
  a local mail catcher before sending.
