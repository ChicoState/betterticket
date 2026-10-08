# ADR-003: Use Server-Side Sessions for Technician Assignment

## Status

Accepted

## Date

2026-10-05

## Context

ADR-001 deliberately deferred ticket assignment until authentication and authorization were
designed. Issue #13 now requires technicians to assign one technician to a ticket, and that rule
cannot safely depend on a caller id or role supplied by the client.

The MVP needs only provisioned users, login/logout, and enough authorization to protect assignment.
It does not need registration, account management, an administrator role, or general ticket
ownership.

## Decision

- A technician is a user whose role is `TECHNICIAN`; the only other role is `USER`.
- Users store a unique username and Argon2id password hash.
- An interactive CLI provisions users; there is no public account-creation endpoint.
- Successful login creates an opaque, expiring server-side session in PostgreSQL and sends the raw
  token in an HttpOnly cookie. PostgreSQL stores only a SHA-256 token hash.
- Protected requests resolve the current user and role from the session and database.
- Any technician may assign, reassign, or unassign any ticket to any technician, including
  themselves.
- Each ticket has a nullable foreign key to one assigned technician, and assignment does not change
  ticket status.

ADR-001 remains accepted: anonymous ticket creation stays public. This decision adds only the
authentication and authorization required for assignment; ticket ownership and general reading,
updating, and deletion remain deferred.

## Alternatives Considered

### Trust a client-supplied user id or role

Rejected because a caller could impersonate a technician or elevate their own permissions.

### Stateless browser tokens

Rejected for the MVP because server-side sessions provide straightforward revocation and always
use the current database role without introducing token refresh or signing-key management.

### Separate technician or credential entities

Rejected because the approved MVP models technicians as users and does not need multiple credential
types.

### Public registration or an admin UI

Rejected because provisioning is sufficient for the MVP and avoids adding unrelated account and
role-management workflows.

## Consequences

- PostgreSQL gains users and sessions in addition to the nullable ticket assignment.
- Login must be rate-limited, cookies must be protected, and passwords/session tokens must never be
  logged or returned.
- Operators provision accounts through `pnpm user:create` until a later account-management feature
  is approved.
- A later user-facing ticket view still needs an ownership and access-control decision.
