# ADR-004: Allow Public Regular-User Registration

## Status

Accepted

## Date

2026-10-10

## Context

ADR-003 intentionally limited account creation to an operator CLI while technician assignment was
introduced. The product now needs a visitor-facing entry flow that allows account creation without
blocking anonymous ticket access. That flow must not let a visitor grant themselves IT privileges.

## Decision

- Add public `POST /api/users` registration for `name`, `username`, and password only.
- The route sets the stored role to `USER`; it rejects a supplied role and never creates a session.
- Keep technician creation in the interactive CLI and retain ADR-003's opaque, server-side sessions.
- Rate-limit registration to five attempts per minute per IP.

## Alternatives Considered

### Keep CLI-only provisioning

Rejected because it does not provide the requested self-service regular-user account flow.

### Let the client select a role

Rejected because a browser-controlled role would allow privilege escalation.

### Add email verification and CAPTCHA

Deferred because neither an email provider nor CAPTCHA service is selected; route-level limiting is
the approved first-line abuse control for this scope.

## Consequences

- ADR-003 remains the source of truth for sessions and technician authorization; this ADR supersedes
  its no-public-registration decision only.
- Users may self-register only as regular users. Password recovery and account lifecycle management
  remain future work.
