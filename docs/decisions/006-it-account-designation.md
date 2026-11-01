# ADR-006: Designate IT Accounts Through an Operator CLI

## Status

Accepted

## Date

2026-10-14

## Context

Issue #55 asks for IT accounts that are separate from regular user accounts so later features can
grant them special abilities. ADR-003 already models IT staff as users with the `TECHNICIAN` role,
and ADR-004 limits self-registration to `USER`. However, an existing account cannot be designated
as IT, and the only IT authorization check is written inline in the assignment route.

## Decision

- "IT account" is the product term for a user whose stored role is `TECHNICIAN`; the stored value
  and API contract are unchanged.
- An interactive operator command, `pnpm user:set-role`, changes an existing user's role between
  `USER` and `TECHNICIAN`. There is no HTTP endpoint for role changes.
- IT-only routes use one shared server-side guard that resolves the role from PostgreSQL on every
  request, so role changes apply on the next request without revoking sessions.
- The account menu labels signed-in IT accounts.

## Alternatives Considered

### Rename the stored role to `IT`

Rejected because it requires an enum migration and an API/web contract change without changing
behavior.

### In-app role management

Deferred because there is no administrator role to authorize it. It should be revisited when IT
abilities grow.

## Consequences

- This extends ADR-003's provisioning-only stance to include CLI role changes; ADR-003 and ADR-004
  otherwise remain in force.
- Operators with database access remain the only people who can grant IT access.
- Demoting every IT account leaves no one able to assign tickets until a user is re-promoted.
